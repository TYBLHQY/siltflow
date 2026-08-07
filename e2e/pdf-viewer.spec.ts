import { test, expect } from "@playwright/test";
import {
  launchApp,
  seedDocument,
  seedAnnotation,
  seedAIV2Annotation,
  makePosition,
  openDocument,
  waitForPdf,
  waitForPageInViewport,
} from "./helpers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = path.resolve(__dirname, "fixtures", "test-350.pdf");

test("opens a seeded PDF and fit-width fills the viewer", async () => {
  const { app, window } = await launchApp((vault) => {
    seedDocument(vault, FIXTURE_PDF);
  });
  try {
    await window.getByRole("tab", { name: "Docs" }).click();
    const docNode = window.locator(`[title="E2E Test PDF"]`);
    await expect(docNode).toBeVisible({ timeout: 20_000 });
    await docNode.click();

    // The PDF viewer mounts.
    await window.waitForSelector(".PdfHighlighter", { timeout: 30_000 });
    await window.waitForSelector(".pdfViewer .page", { timeout: 30_000 });

    // Fit-width is on by default: the first rendered page should span the
    // viewer's content width (within a small tolerance).
    const pageWidthInfo = await window.evaluate(() => {
      const container = document.querySelector<HTMLElement>(".PdfHighlighter");
      const firstPage = container?.querySelector<HTMLElement>(
        '.page[data-page-number="1"]',
      );
      if (!container || !firstPage) return null;
      const pageRect = firstPage.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return {
        pageWidth: pageRect.width,
        containerWidth: containerRect.width,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        scrollTop: container.scrollTop,
      };
    });
    expect(pageWidthInfo).not.toBeNull();
    // Page width should match the container width (fit-to-width).
    expect(pageWidthInfo!.pageWidth).toBeGreaterThan(
      pageWidthInfo!.containerWidth * 0.95,
    );
    expect(pageWidthInfo!.pageWidth).toBeLessThanOrEqual(
      pageWidthInfo!.containerWidth * 1.05,
    );
  } finally {
    await app.close();
  }
});

test("scrolls to a far-page highlight from the annotations card", async () => {
  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    seedAnnotation(vault, docId, {
      id: "ann-p300",
      pageNumber: 300,
      text: "E2E far-page annotation",
      position: {
        boundingRect: {
          x1: 50,
          y1: 350,
          x2: 300,
          y2: 370,
          width: 612,
          height: 792,
          pageNumber: 300,
        },
        rects: [
          {
            x1: 50,
            y1: 350,
            x2: 300,
            y2: 370,
            width: 612,
            height: 792,
            pageNumber: 300,
          },
        ],
        usePdfCoordinates: false,
      },
    });
  });
  try {
    await window.getByRole("tab", { name: "Docs" }).click();
    await window.locator(`[title="E2E Test PDF"]`).click();
    await window.waitForSelector(".PdfHighlighter", { timeout: 30_000 });
    await window.waitForSelector(".pdfViewer .page", { timeout: 30_000 });

    // Switch to the Annotations tab in the right panel.
    await window.getByRole("tab", { name: "Annotations" }).click();
    const card = window.locator('[data-annotation-id="ann-p300"]');
    await expect(card).toBeVisible({ timeout: 20_000 });

    // Click the "go to highlight" button on the card → scrolls to page 300.
    const goTo = card.locator('[title="Go to highlight in PDF"]');
    await goTo.click();

    // Wait for the viewer to scroll near the target (page 300 of 350).
    // Smooth-scrolling 300 pages is frame-rate-bound — under parallel-worker
    // CPU contention it can take well over 30s, so allow a generous budget.
    await window.waitForFunction(
      () => {
        const container =
          document.querySelector<HTMLElement>(".PdfHighlighter");
        if (!container) return false;
        // We've reached the target if the target page is within the viewport.
        const targetPage = container.querySelector<HTMLElement>(
          '.page[data-page-number="300"]',
        );
        if (!targetPage) return false;
        const pageRect = targetPage.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Page top is at or above container bottom (page entered the viewport).
        return pageRect.top <= containerRect.bottom + 200;
      },
      { timeout: 60_000 },
    );

    // Sanity: scroll position is far from the top (we actually moved).
    const scrollInfo = await window.evaluate(() => {
      const container = document.querySelector<HTMLElement>(".PdfHighlighter");
      return container
        ? {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
          }
        : null;
    });
    expect(scrollInfo).not.toBeNull();
    expect(scrollInfo!.scrollTop).toBeGreaterThan(
      scrollInfo!.scrollHeight * 0.5,
    );
  } finally {
    await app.close();
  }
});

// Regression: clicking a PDF annotation highlight expands its card in the right
// panel (200ms grid-template-rows animation) while RightPanel scrolls the card
// into view. scrollIntoView targets the geometry at call time, so scrolling
// mid-animation used to land the card off-center. The card must end up centered
// in the list viewport, measured twice (stable) to catch the drift.
test("annotation card lands centered after highlight click (scrollIntoView)", async () => {
  // V2 result so the card renders the collapsible details animation. Each card
  // gets a unique normalized input — the card header renders the NORMALIZED
  // text (ai.spec.ts: "Source text is the normalized input"), so tests must
  // locate cards by it, not by the raw text.
  const makeCompact = (word: string) => ({
    input: {
      text: word,
      normalized: word,
      source_lang: "en-US",
      type: "word",
      lemma: word,
    },
    context: null,
    output: {
      meanings: [{ pos: "VERB", translation: "忍受" }],
      definitions: [
        {
          pos: "VERB",
          definition: {
            source: "to suffer through something difficult",
            target: "忍受艰难之事",
          },
        },
      ],
      examples: [
        {
          sentence: "She endured the long journey.",
          translation: "她忍受了漫长的旅程。",
        },
      ],
      collocations: [{ phrase: "endure pain", translation: "忍受疼痛" }],
      synonyms: ["tolerate", "withstand"],
      cefr: "B2",
    },
  });
  // The target's details are deliberately LARGE so its own expand pushes its
  // center down by a lot (~half the expanded height). scrollIntoView called
  // mid-animation computes the landing from the collapsed geometry, leaving
  // the card hundreds of px off-center — larger than the vpH/6 tolerance, so
  // the assertion discriminates fixed vs broken.
  const makeBig = (word: string) => ({
    input: {
      text: word,
      normalized: word,
      source_lang: "en-US",
      type: "word",
      lemma: word,
    },
    context: null,
    output: {
      meanings: Array.from({ length: 6 }, (_, i) => ({
        pos: i % 2 ? "NOUN" : "VERB",
        translation: `含义${i}`,
      })),
      definitions: Array.from({ length: 5 }, (_, i) => ({
        pos: "VERB",
        definition: {
          source: `source definition number ${i} with extra words to wrap`,
          target: `目标释义第 ${i} 条，内容稍长以撑高详情区`,
        },
      })),
      examples: Array.from({ length: 6 }, (_, i) => ({
        sentence: `Example sentence number ${i} used to bulk the details area.`,
        translation: `例句翻译第 ${i} 条`,
      })),
      collocations: Array.from({ length: 5 }, (_, i) => ({
        phrase: `collocation phrase ${i}`,
        translation: `搭配 ${i}`,
      })),
      synonyms: ["alpha", "bravo", "charlie", "delta"],
      cefr: "C1",
    },
  });

  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    // A stack of V2 cards on early pages bulks the list so its content far
    // exceeds the viewport — without overflow there is no scroll room for
    // block:"center" to move the card.
    for (let i = 0; i < 20; i++) {
      seedAIV2Annotation(vault, docId, {
        id: `v2-filler-${i}`,
        pageNumber: 1 + i,
        text: `filler word ${i}`,
        aiResult: makeCompact(`filler${i}`),
        position: makePosition(1 + i, { x1: 50, y1: 300, x2: 300, y2: 320 }),
      });
    }
    // The target sits in the MIDDLE of the list — 20 cards above, 15 below.
    // A card near the very top/bottom can never be centered: the browser
    // clamps scrollTop to [0, scrollHeight - clientHeight]. Only a genuinely
    // middle card has free scroll room on both sides, so any mid-animation
    // drift shows up as an off-center landing rather than a clamp artifact.
    seedAIV2Annotation(vault, docId, {
      id: "v2-target",
      pageNumber: 50,
      text: "target word",
      aiResult: makeBig("targetword"),
      position: makePosition(50, { x1: 50, y1: 350, x2: 300, y2: 370 }),
    });
    // Cards below the target so the list overflows below it too.
    for (let i = 0; i < 15; i++) {
      seedAIV2Annotation(vault, docId, {
        id: `v2-tail-${i}`,
        pageNumber: 60 + i,
        text: `tail word ${i}`,
        aiResult: makeCompact(`tail${i}`),
        position: makePosition(60 + i, { x1: 50, y1: 350, x2: 300, y2: 370 }),
      });
    }
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Click the target's PDF highlight on page 50. This dispatches
    // annotation-click: the target card starts a 200ms expand (its LARGE
    // details push its center down by a few hundred px) and RightPanel runs
    // scrollIntoView. Pre-fix, the scroll targeted the collapsed geometry and
    // the card landed off-center; the fix waits for the transition to settle.
    const nav = window.locator("div", { hasText: "/ 350" }).first();
    await nav.getByTitle("Jump to page").click();
    const pageInput = nav.locator("input").first();
    await pageInput.fill("50");
    await pageInput.press("Enter");
    await waitForPageInViewport(window, 50);

    await window.waitForSelector(
      ".PdfHighlighter__highlight-layer .TextHighlight__part",
    );
    const center = await window.evaluate(() => {
      const parts = [
        ...document.querySelectorAll(
          ".PdfHighlighter__highlight-layer .TextHighlight__part",
        ),
      ] as HTMLElement[];
      // Exact page match — includes() would hit "50" vs "500".
      const target = parts.find(
        (p) => p.closest(".page")?.getAttribute("data-page-number") === "50",
      );
      const r = target!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await window.mouse.click(center.x, center.y);

    const card = window.locator('[data-annotation-id="v2-target"]');
    await expect(card).toBeVisible({ timeout: 20_000 });

    // The right-panel list viewport is the Radix ScrollArea viewport. There
    // are two ScrollAreas on screen (left panel + right panel) — the right
    // panel one is last in DOM order.
    const viewport = window.locator("[data-radix-scroll-area-viewport]").last();
    await expect(viewport).toBeVisible();

    // Wait for the expand animation + smooth scroll to settle. Poll the card's
    // offset from the viewport center until two consecutive reads agree — the
    // smooth scroll is async, so a fixed sleep is unreliable under contention.
    const readOffset = () =>
      window.evaluate(
        ({ selector }) => {
          const vps = [
            ...document.querySelectorAll<HTMLElement>(
              "[data-radix-scroll-area-viewport]",
            ),
          ];
          const vp = vps[vps.length - 1];
          const el = document.querySelector<HTMLElement>(selector);
          if (!vp || !el) return null;
          const vr = vp.getBoundingClientRect();
          const er = el.getBoundingClientRect();
          // Signed distance between the card's center and the viewport's
          // center, in px. Positive = card sits below center.
          return er.top + er.height / 2 - (vr.top + vr.height / 2);
        },
        { selector: '[data-annotation-id="v2-target"]' },
      );

    let lastOffset: number | null = null;
    let settledOffset: number | null = null;
    let vpH = 0;
    for (let i = 0; i < 40; i++) {
      const sample = await readOffset();
      if (sample === null) {
        await window.waitForTimeout(100);
        continue;
      }
      const vp = await window.evaluate(() => {
        const vps = [
          ...document.querySelectorAll<HTMLElement>(
            "[data-radix-scroll-area-viewport]",
          ),
        ];
        return vps[vps.length - 1]?.getBoundingClientRect().height ?? 0;
      });
      vpH = vp;
      if (lastOffset !== null && Math.abs(sample - lastOffset) < 4) {
        settledOffset = sample;
        break;
      }
      lastOffset = sample;
      await window.waitForTimeout(100);
    }
    expect(vpH).toBeGreaterThan(0);
    expect(settledOffset).not.toBeNull();

    // The card must be within 1/6 of the viewport height from center. The
    // pre-fix drift source (the above card collapsing ~316px during the
    // target's scroll) is larger than this tolerance, so the assertion
    // discriminates fixed vs broken. A mid-animation scrollIntoView would
    // leave the target hundreds of px off-center.
    expect(Math.abs(settledOffset!)).toBeLessThanOrEqual(vpH / 6);

    // Stability: a second read after a beat must show the same position
    // (no late re-anchoring from the animation settling mid-measure).
    await window.waitForTimeout(500);
    const after = await readOffset();
    expect(after).not.toBeNull();
    expect(Math.abs(after!)).toBeLessThanOrEqual(vpH / 6);
  } finally {
    await app.close();
  }
});

// Regression: clicking a highlight whose card is UNTRANSLATED. Such a card has
// no collapsible grid of its own (details only render for V2), so the old
// per-card stability check saw `grid === null` and scrolled immediately. But
// reassigning expandedCardId collapses the previously-expanded V2 card ABOVE it
// in the same tick, and that 200ms animation shifts the whole list — the card
// landed off-center. The stability check must watch every running grid in the
// list, not just the target's.
test("untranslated card lands centered when a V2 card above collapses", async () => {
  const makeCompact = (word: string) => ({
    input: {
      text: word,
      normalized: word,
      source_lang: "en-US",
      type: "word",
      lemma: word,
    },
    context: null,
    output: {
      meanings: [{ pos: "VERB", translation: "忍受" }],
      definitions: [
        {
          pos: "VERB",
          definition: {
            source: "to suffer through something difficult",
            target: "忍受艰难之事",
          },
        },
      ],
      examples: [
        {
          sentence: "She endured the long journey.",
          translation: "她忍受了漫长的旅程。",
        },
      ],
      collocations: [{ phrase: "endure pain", translation: "忍受疼痛" }],
      synonyms: ["tolerate", "withstand"],
      cefr: "B2",
    },
  });
  // The collapsing card's details are LARGE, so its collapse raises everything
  // below by a lot. scrollIntoView called at that moment targets the still-
  // expanded geometry; when the collapse settles the target sits hundreds of px
  // above center — larger than the vpH/6 tolerance, so the assertion
  // discriminates fixed vs broken.
  const makeBig = (word: string) => ({
    input: {
      text: word,
      normalized: word,
      source_lang: "en-US",
      type: "word",
      lemma: word,
    },
    context: null,
    output: {
      meanings: Array.from({ length: 6 }, (_, i) => ({
        pos: i % 2 ? "NOUN" : "VERB",
        translation: `含义${i}`,
      })),
      definitions: Array.from({ length: 5 }, (_, i) => ({
        pos: "VERB",
        definition: {
          source: `source definition number ${i} with extra words to wrap`,
          target: `目标释义第 ${i} 条，内容稍长以撑高详情区`,
        },
      })),
      examples: Array.from({ length: 6 }, (_, i) => ({
        sentence: `Example sentence number ${i} used to bulk the details area.`,
        translation: `例句翻译第 ${i} 条`,
      })),
      collocations: Array.from({ length: 5 }, (_, i) => ({
        phrase: `collocation phrase ${i}`,
        translation: `搭配 ${i}`,
      })),
      synonyms: ["alpha", "bravo", "charlie", "delta"],
      cefr: "C1",
    },
  });

  const { app, window } = await launchApp((vault) => {
    const docId = seedDocument(vault, FIXTURE_PDF);
    // A stack of compact V2 cards on early pages bulks the list so its content
    // far exceeds the viewport — without overflow there is no scroll room for
    // block:"center" to move the card.
    for (let i = 0; i < 16; i++) {
      seedAIV2Annotation(vault, docId, {
        id: `v2-filler-${i}`,
        pageNumber: 1 + i,
        text: `filler word ${i}`,
        aiResult: makeCompact(`filler${i}`),
        position: makePosition(1 + i, { x1: 50, y1: 300, x2: 300, y2: 320 }),
      });
    }
    // The card that starts EXPANDED, sitting just above the target. Clicking a
    // highlight on the target below reassigns expandedCardId, collapsing this
    // card — its LARGE details disappear and the list shifts up a lot.
    seedAIV2Annotation(vault, docId, {
      id: "v2-collapse",
      pageNumber: 40,
      text: "collapse word",
      aiResult: makeBig("collapseword"),
      position: makePosition(40, { x1: 50, y1: 350, x2: 300, y2: 370 }),
    });
    // The UNTRANSLATED target (no aiResult → AIAnnotationResultBase, no
    // collapsible grid) sits in the MIDDLE of the list — 17 cards above it,
    // 15 below, so it has free scroll room on both sides. It's near the page
    // range where the collapsing card above dominates the layout shift.
    seedAnnotation(vault, docId, {
      id: "untranslated-target",
      pageNumber: 50,
      text: "untranslated target word",
      position: makePosition(50, { x1: 50, y1: 350, x2: 300, y2: 370 }),
    });
    // Cards below the target so the list overflows below it too.
    for (let i = 0; i < 15; i++) {
      seedAIV2Annotation(vault, docId, {
        id: `v2-tail-${i}`,
        pageNumber: 60 + i,
        text: `tail word ${i}`,
        aiResult: makeCompact(`tail${i}`),
        position: makePosition(60 + i, { x1: 50, y1: 350, x2: 300, y2: 370 }),
      });
    }
  });
  try {
    await openDocument(window, "E2E Test PDF");
    await waitForPdf(window);

    // Pre-expand the V2 card ABOVE the target. In the real app a previous click
    // on the PDF leaves its card expanded; simulating that here sets up the
    // collapse that must be waited on. Give the expand animation a beat to
    // finish so the collapse in the click below is a clean single transition.
    await window.evaluate(() => {
      void window.dispatchEvent(
        new CustomEvent("siltflow:annotation-click", {
          detail: { id: "v2-collapse" },
        }),
      );
    });
    await expect(
      window.locator('[data-annotation-id="v2-collapse"]'),
    ).toBeVisible({ timeout: 20_000 });
    await window.waitForTimeout(400);

    // Click the target's PDF highlight on page 50. This dispatches
    // annotation-click: the target card (UNTRANSLATED, no grid) renders, while
    // expandedCardId reassignment starts the collapse of the V2 card above.
    const nav = window.locator("div", { hasText: "/ 350" }).first();
    await nav.getByTitle("Jump to page").click();
    const pageInput = nav.locator("input").first();
    await pageInput.fill("50");
    await pageInput.press("Enter");
    await waitForPageInViewport(window, 50);

    await window.waitForSelector(
      ".PdfHighlighter__highlight-layer .TextHighlight__part",
    );
    const center = await window.evaluate(() => {
      const parts = [
        ...document.querySelectorAll(
          ".PdfHighlighter__highlight-layer .TextHighlight__part",
        ),
      ] as HTMLElement[];
      // Exact page match — includes() would hit "50" vs "500".
      const target = parts.find(
        (p) => p.closest(".page")?.getAttribute("data-page-number") === "50",
      );
      const r = target!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await window.mouse.click(center.x, center.y);

    const card = window.locator('[data-annotation-id="untranslated-target"]');
    await expect(card).toBeVisible({ timeout: 20_000 });

    // The right-panel list viewport is the Radix ScrollArea viewport. There
    // are two ScrollAreas on screen (left panel + right panel) — the right
    // panel one is last in DOM order.
    const viewport = window.locator("[data-radix-scroll-area-viewport]").last();
    await expect(viewport).toBeVisible();

    // Wait for the collapse animation + smooth scroll to settle. Poll the
    // card's offset from the viewport center until two consecutive reads agree.
    const readOffset = () =>
      window.evaluate(
        ({ selector }) => {
          const vps = [
            ...document.querySelectorAll<HTMLElement>(
              "[data-radix-scroll-area-viewport]",
            ),
          ];
          const vp = vps[vps.length - 1];
          const el = document.querySelector<HTMLElement>(selector);
          if (!vp || !el) return null;
          const vr = vp.getBoundingClientRect();
          const er = el.getBoundingClientRect();
          // Signed distance between the card's center and the viewport's
          // center, in px. Positive = card sits below center.
          return er.top + er.height / 2 - (vr.top + vr.height / 2);
        },
        { selector: '[data-annotation-id="untranslated-target"]' },
      );

    let lastOffset: number | null = null;
    let settledOffset: number | null = null;
    let vpH = 0;
    for (let i = 0; i < 40; i++) {
      const sample = await readOffset();
      if (sample === null) {
        await window.waitForTimeout(100);
        continue;
      }
      const vp = await window.evaluate(() => {
        const vps = [
          ...document.querySelectorAll<HTMLElement>(
            "[data-radix-scroll-area-viewport]",
          ),
        ];
        return vps[vps.length - 1]?.getBoundingClientRect().height ?? 0;
      });
      vpH = vp;
      if (lastOffset !== null && Math.abs(sample - lastOffset) < 4) {
        settledOffset = sample;
        break;
      }
      lastOffset = sample;
      await window.waitForTimeout(100);
    }
    expect(vpH).toBeGreaterThan(0);
    expect(settledOffset).not.toBeNull();

    // The card must be within 1/6 of the viewport height from center. The
    // pre-fix drift source (the card above collapsing several hundred px during
    // the target's scroll) is larger than this tolerance, so the assertion
    // discriminates fixed vs broken.
    expect(Math.abs(settledOffset!)).toBeLessThanOrEqual(vpH / 6);

    // Stability: a second read after a beat must show the same position.
    await window.waitForTimeout(500);
    const after = await readOffset();
    expect(after).not.toBeNull();
    expect(Math.abs(after!)).toBeLessThanOrEqual(vpH / 6);
  } finally {
    await app.close();
  }
});
