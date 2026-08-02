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

function mockPipelineResponses() {
  let call = 0;
  mockedChat.mockImplementation(async (_profile, _messages, onChunk) => {
    call++;
    onChunk({ content: call === 1 ? INPUT_JSON : OUTPUT_JSON, done: true });
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
      context: "DOC_CTX",
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
      context: "DOC_CTX",
      userContext: "MY_NOTE",
    });

    expect(result.context).toBe("DOC_CTX");
    expect(result.context).not.toContain("MY_NOTE");
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

    expect(result.context).toBeNull();
  });
});
