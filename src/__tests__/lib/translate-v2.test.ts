import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AIProfile } from "@/types/ai";
import type { AIAnnotationInputV2 } from "@/types/annotation";
import { chatCompletion } from "@/lib/ai";
import {
  buildOutputUserMessage,
  translateAnnotationV2,
} from "@/lib/translate-v2";

// Mock the AI transport so the pipeline runs without a network call.
// The mock returns input-stage JSON on the first call and output-stage JSON
// on the second, and captures every message array it receives.
vi.mock("@/lib/ai", () => ({
  chatCompletion:
    vi.fn<
      (
        profile: AIProfile,
        messages: Array<{ role: "system" | "user"; content: string }>,
        onChunk: (chunk: { content: string; done?: boolean }) => void,
        signal?: AbortSignal,
      ) => Promise<void>
    >(),
}));

const mockedChat = vi.mocked(chatCompletion);

const INPUT_JSON = JSON.stringify({
  text: "grok",
  normalized: "grok",
  source_lang: "en-US",
  type: "word",
  lemma: "grok",
});
const OUTPUT_JSON = JSON.stringify({
  meanings: [{ pos: "VERB", translation: "领会" }],
  definitions: [],
  examples: [],
  collocations: [],
  synonyms: [],
  cefr: "B2",
});

const PHRASE_OUTPUT_JSON = JSON.stringify({
  translation: "一个短语",
  examples: [{ sentence: "a short phrase", translation: "一个短语" }],
});

function mockPipelineResponses() {
  let call = 0;
  mockedChat.mockImplementation(async (_profile, _messages, onChunk) => {
    call++;
    onChunk({ content: call === 1 ? INPUT_JSON : OUTPUT_JSON, done: true });
  });
}

/** The short-circuit path fires ONLY the output stage — a single completion call. */
function mockSingleOutputCall() {
  mockedChat.mockImplementation(async (_profile, _messages, onChunk) => {
    onChunk({ content: PHRASE_OUTPUT_JSON, done: true });
  });
}

/** Flat input fixture for buildOutputUserMessage unit tests. */
const input: AIAnnotationInputV2 = {
  text: "grok",
  normalized: "grok",
  source_lang: "en-US",
  type: "word",
  lemma: "grok",
};

beforeEach(() => {
  mockedChat.mockReset();
});

describe("buildOutputUserMessage", () => {
  it("orders context, IMPORTANT, user context, then Input", () => {
    const msg = buildOutputUserMessage(input, "zh-CN", "DOC_CTX", "MY_NOTE");

    const contextIdx = msg.indexOf("CONTEXT (document excerpt");
    const importantIdx = msg.indexOf("IMPORTANT: All translations");
    const userCtxIdx = msg.indexOf("USER CONTEXT (user-authored note");
    const inputIdx = msg.indexOf("Input:");

    expect(contextIdx).toBeGreaterThanOrEqual(0);
    expect(importantIdx).toBeGreaterThan(contextIdx);
    expect(userCtxIdx).toBeGreaterThan(importantIdx);
    expect(inputIdx).toBeGreaterThan(userCtxIdx);
    expect(msg).toContain("DOC_CTX");
    expect(msg).toContain("MY_NOTE");
  });

  it("omits both context blocks when none are provided", () => {
    const msg = buildOutputUserMessage(input, "zh-CN", undefined, undefined);
    expect(msg).not.toContain("CONTEXT");
    expect(msg).not.toContain("USER CONTEXT");
    expect(msg).toContain("Input:");
  });

  it("truncates the user context at 5000 chars", () => {
    const long = "x".repeat(6000);
    const msg = buildOutputUserMessage(input, "zh-CN", undefined, long);

    // 5000 chars + ellipsis, and the tail beyond 5000 is gone.
    expect(msg).toContain(`${"x".repeat(5000)}…`);
    expect(msg).not.toContain("x".repeat(5001));
  });
});

describe("translateAnnotationV2", () => {
  it("never sends context to the input stage, but sends it to the output stage", async () => {
    mockPipelineResponses();

    await translateAnnotationV2({
      inputProfile: { id: "i", model: "m" } as never,
      outputProfile: { id: "o", model: "m" } as never,
      text: "grok",
      sourceLang: "en-US",
      targetLang: "zh-CN",
      documentContext: "DOC_CTX",
      userContext: "MY_NOTE",
    });

    const [inputCall, outputCall] = mockedChat.mock.calls;
    const inputUserMsg = inputCall[1][1].content;
    const outputUserMsg = outputCall[1][1].content;

    // Input stage: no context anywhere.
    expect(inputUserMsg).not.toContain("CONTEXT");
    expect(inputUserMsg).not.toContain("USER CONTEXT");
    expect(inputUserMsg).not.toContain("DOC_CTX");
    expect(inputUserMsg).not.toContain("MY_NOTE");

    // Output stage: both auto and user context present.
    expect(outputUserMsg).toContain("DOC_CTX");
    expect(outputUserMsg).toContain("MY_NOTE");
  });

  it("echoes only the auto context into the result blob", async () => {
    mockPipelineResponses();

    const result = await translateAnnotationV2({
      inputProfile: { id: "i", model: "m" } as never,
      outputProfile: { id: "o", model: "m" } as never,
      text: "grok",
      sourceLang: "en-US",
      targetLang: "zh-CN",
      documentContext: "DOC_CTX",
      userContext: "MY_NOTE",
    });

    expect(result.documentContext).toBe("DOC_CTX");
    expect(result.documentContext).not.toContain("MY_NOTE");
  });

  it("stores null context when no auto context is given", async () => {
    mockPipelineResponses();

    const result = await translateAnnotationV2({
      inputProfile: { id: "i", model: "m" } as never,
      outputProfile: { id: "o", model: "m" } as never,
      text: "grok",
      sourceLang: "en-US",
      targetLang: "zh-CN",
      userContext: "MY_NOTE",
    });

    expect(result.documentContext).toBeNull();
  });

  // ── Short-circuit: phrase/sentence + language hint skip the input AI ──

  it("skips the input AI for a phrase with a concrete language hint (1 call)", async () => {
    mockSingleOutputCall();

    const result = await translateAnnotationV2({
      inputProfile: { id: "i", model: "m" } as never,
      outputProfile: { id: "o", model: "m" } as never,
      text: "a short phrase",
      sourceLang: "en-US",
      targetLang: "zh-CN",
    });

    expect(mockedChat).toHaveBeenCalledTimes(1);
    const outputUserMsg = mockedChat.mock.calls[0][1][1].content;
    expect(outputUserMsg).toContain('"type":"phrase"');
    expect(outputUserMsg).toContain('"lemma":null');
    expect(outputUserMsg).toContain('"source_lang":"en-US"');
    expect(result.input).toEqual({
      text: "a short phrase",
      normalized: "a short phrase",
      source_lang: "en-US",
      type: "phrase",
      lemma: null,
    });
  });

  it("skips the input AI for a sentence with a concrete language hint (1 call)", async () => {
    mockSingleOutputCall();

    await translateAnnotationV2({
      inputProfile: { id: "i", model: "m" } as never,
      outputProfile: { id: "o", model: "m" } as never,
      text: "First sentence. Second sentence.",
      sourceLang: "en-US",
      targetLang: "zh-CN",
    });

    expect(mockedChat).toHaveBeenCalledTimes(1);
    expect(mockedChat.mock.calls[0][1][1].content).toContain(
      '"type":"sentence"',
    );
  });

  it("keeps the input AI when the source-language hint is unknown", async () => {
    mockPipelineResponses();

    await translateAnnotationV2({
      inputProfile: { id: "i", model: "m" } as never,
      outputProfile: { id: "o", model: "m" } as never,
      text: "a short phrase",
      targetLang: "zh-CN", // no sourceLang → "und"
    });

    expect(mockedChat).toHaveBeenCalledTimes(2);
  });

  it("keeps the input AI for words (lemma is a linguistic round-trip)", async () => {
    mockPipelineResponses();

    await translateAnnotationV2({
      inputProfile: { id: "i", model: "m" } as never,
      outputProfile: { id: "o", model: "m" } as never,
      text: "grok",
      sourceLang: "en-US",
      targetLang: "zh-CN",
    });

    expect(mockedChat).toHaveBeenCalledTimes(2);
  });

  it("normalizes via JS in the short-circuit path (trim, collapse, NFC)", async () => {
    mockSingleOutputCall();

    // "e" + U+0301 (combining acute, decomposed) → NFC composes to U+00E9.
    const result = await translateAnnotationV2({
      inputProfile: { id: "i", model: "m" } as never,
      outputProfile: { id: "o", model: "m" } as never,
      text: "  A  fine étude  ",
      sourceLang: "en-US",
      targetLang: "zh-CN",
    });

    expect(result.input.normalized).toBe("A fine étude");
    expect(result.input.type).toBe("phrase");
    expect(result.input.lemma).toBeNull();
  });
});
