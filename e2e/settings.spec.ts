import { test, expect, type ElectronApplication } from "@playwright/test";
import { launchApp, seedAIConfig } from "./helpers";
import { readFileSync, writeFileSync } from "node:fs";

const SILTFLOW_DIR = ".siltflow";

type Window = Awaited<ReturnType<ElectronApplication["firstWindow"]>>;

// ---------------------------------------------------------------------------
// Settings dialog E2E.
//
// Settings persist to the vault's `.siltflow/config.json` via
// `window.siltflow.vaultConfigSet` (each store under its own key). So every
// tab test does two assertions:
//   1. UI — click the control, watch the rendered value change.
//   2. Persistence — poll config.json until the app's async write lands
//      (same pattern as last-page.spec.ts).
//
// TTS tab note: opening it auto-triggers `refreshVoices()` (spawns
// `edge-tts --list-voices`) unless `voiceLists` is already cached. Tests that
// open the TTS tab seed a voiceLists entry so no external process is needed.
// ---------------------------------------------------------------------------

/** Merge a config patch into the vault's config.json BEFORE the app boots. */
function writeConfig(vault: string, patch: Record<string, unknown>) {
  const cfgPath = `${vault}/${SILTFLOW_DIR}/config.json`;
  let cfg: Record<string, unknown> = {};
  try {
    cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
  } catch {
    /* fresh vault — no config yet */
  }
  writeFileSync(cfgPath, JSON.stringify({ ...cfg, ...patch }));
}

function readConfig(vault: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(`${vault}/${SILTFLOW_DIR}/config.json`, "utf-8"),
  );
}

/** Poll config.json until the predicate holds (vaultConfigSet is async). */
function expectConfig(
  vault: string,
  predicate: (cfg: Record<string, unknown>) => unknown,
) {
  return expect
    .poll(
      () => {
        try {
          return predicate(readConfig(vault));
        } catch {
          return null; // config not written yet
        }
      },
      { timeout: 15_000, message: "setting never persisted to config.json" },
    )
    .toBeTruthy();
}

async function openSettings(window: Window) {
  await window.getByTitle("Settings").click();
  const dialog = window.locator('[role="dialog"]:visible');
  await expect(dialog).toBeVisible();
  return dialog;
}

// ---------------------------------------------------------------------------
// Test 1 — dialog opens, all six tabs render, About update toggle persists
// ---------------------------------------------------------------------------
test("settings dialog renders all tabs and About update toggle persists", async () => {
  const { app, window, vault } = await launchApp((vaultDir) => {
    // Pre-cache TTS voices so opening the TTS tab doesn't spawn edge-tts.
    writeConfig(vaultDir, {
      ttsConfig: {
        provider: "edge-tts",
        voiceLists: { "en-US": ["en-US-EmmaMultilingualNeural"] },
      },
    });
  });
  try {
    const dialog = await openSettings(window);

    // Default tab is AI.
    await expect(dialog.getByText("AI Providers")).toBeVisible();

    // Each tab shows its own header.
    await dialog.getByRole("button", { name: "Spaced Repetition" }).click();
    await expect(dialog.getByText("Spaced Repetition (FSRS)")).toBeVisible();

    await dialog.getByRole("button", { name: "Style" }).click();
    await expect(dialog.getByText("Paragraph Style")).toBeVisible();

    await dialog.getByRole("button", { name: "TTS" }).click();
    await expect(dialog.getByText("TTS (Edge-TTS)")).toBeVisible();

    await dialog.getByRole("button", { name: "Shortcuts" }).click();
    await expect(dialog.getByText("Keyboard Shortcuts")).toBeVisible();

    await dialog.getByRole("button", { name: "About" }).click();
    await expect(dialog.getByText("Current Version")).toBeVisible();

    // About: check-for-updates toggle persists. launchApp seeds it false.
    const updateCheck = dialog.getByLabel("Check for updates on startup");
    await expect(updateCheck).not.toBeChecked();
    await updateCheck.click();
    await expect(updateCheck).toBeChecked();
    await expectConfig(
      vault,
      (cfg) =>
        (cfg.appSettings as { checkUpdateOnStartup?: boolean } | undefined)
          ?.checkUpdateOnStartup === true,
    );
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Test 2 — theme mode toggle applies classes and persists
// ---------------------------------------------------------------------------
test("theme mode toggle applies light/dark classes and persists", async () => {
  const { app, window, vault } = await launchApp();
  try {
    const dialog = await openSettings(window);
    await dialog.getByRole("button", { name: "Style" }).click();

    // Light: html gets the latte flavor and loses the shadcn .dark class.
    await dialog.getByRole("button", { name: "Light" }).click();
    await expect(window.locator("html")).toHaveClass(/latte/);
    await expect(window.locator("html")).not.toHaveClass(/dark/);

    // Dark: mocha flavor + .dark, persisted to vault config.
    await dialog.getByRole("button", { name: "Dark" }).click();
    await expect(window.locator("html")).toHaveClass(/dark/);
    await expect(window.locator("html")).toHaveClass(/mocha/);

    await expectConfig(
      vault,
      (cfg) =>
        (cfg.themeConfig as { themeMode?: string } | undefined)?.themeMode ===
        "dark",
    );
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Test 3 — seeded dark theme is restored on boot (loadThemeFromVault)
// ---------------------------------------------------------------------------
test("seeded dark theme is applied on boot", async () => {
  const { app, window } = await launchApp((vaultDir) => {
    writeConfig(vaultDir, {
      themeConfig: {
        lightTheme: "latte",
        darkTheme: "mocha",
        themeMode: "dark",
        pdfDarkInvert: "invert",
      },
    });
  });
  try {
    // The store loads themeConfig from vault on boot and App applies it.
    await expect(window.locator("html")).toHaveClass(/dark/);
    await expect(window.locator("html")).toHaveClass(/mocha/);
    await expect(window.locator("html")).not.toHaveClass(/latte/);
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Test 4 — AI provider rename + delete persist
// ---------------------------------------------------------------------------
test("AI provider rename and delete persist", async () => {
  const { app, window, vault } = await launchApp((vaultDir) => {
    // Seed one custom profile (no mock server needed — no AI call runs).
    seedAIConfig(vaultDir, { port: 9999 });
  });
  try {
    const dialog = await openSettings(window);
    await expect(dialog.getByText("AI Providers")).toBeVisible();

    // Rename: click Rename → input appears → type → Enter.
    await dialog.getByRole("button", { name: "Rename" }).click();
    const renameInput = dialog.getByRole("textbox");
    await renameInput.fill("Renamed AI");
    await expect(renameInput).toHaveValue("Renamed AI");
    await window.keyboard.press("Enter");

    // Profile card shows the new name (also appears in task dropdowns → .first()).
    await expect(dialog.getByText("Renamed AI").first()).toBeVisible();
    await expectConfig(
      vault,
      (cfg) =>
        ((cfg.aiStore as Array<{ name: string }> | undefined) ?? [])[0]
          ?.name === "Renamed AI",
    );

    // Delete: profile disappears and config row count drops to zero.
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(dialog.getByText("Renamed AI")).not.toBeVisible();
    await expectConfig(
      vault,
      (cfg) => ((cfg.aiStore as unknown[] | undefined) ?? []).length === 0,
    );
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Test 5 — FSRS retention slider + reset persist
// ---------------------------------------------------------------------------
test("FSRS retention slider changes and reset restores defaults", async () => {
  const { app, window, vault } = await launchApp();
  try {
    const dialog = await openSettings(window);
    await dialog.getByRole("button", { name: "Spaced Repetition" }).click();

    // Retention slider default 0.85 → ArrowLeft ×2 → 0.83 (step 0.01).
    const retention = dialog.locator('input[type="range"]').first();
    await expect(dialog.getByText("Retention rate (85%)")).toBeVisible();
    await retention.focus();
    await window.keyboard.press("ArrowLeft");
    await window.keyboard.press("ArrowLeft");
    await expect(dialog.getByText("Retention rate (83%)")).toBeVisible();

    await expectConfig(
      vault,
      (cfg) =>
        (cfg.fsrsParams as { request_retention?: number } | undefined)
          ?.request_retention !== undefined &&
        (cfg.fsrsParams as { request_retention: number }).request_retention <
          0.85,
    );

    // Reset → back to 85% and persisted as the default.
    await dialog.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(dialog.getByText("Retention rate (85%)")).toBeVisible();
    await expectConfig(
      vault,
      (cfg) =>
        (cfg.fsrsParams as { request_retention?: number } | undefined)
          ?.request_retention === 0.85,
    );
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Test 6 — TTS provider switch (Edge-TTS → MiMo) persists
// ---------------------------------------------------------------------------
test("TTS provider switch from Edge-TTS to MiMo persists", async () => {
  const { app, window, vault } = await launchApp((vaultDir) => {
    // Pre-cache voices so the TTS tab doesn't spawn edge-tts --list-voices.
    writeConfig(vaultDir, {
      ttsConfig: {
        provider: "edge-tts",
        voiceLists: { "en-US": ["en-US-EmmaMultilingualNeural"] },
      },
    });
  });
  try {
    const dialog = await openSettings(window);
    await dialog.getByRole("button", { name: "TTS" }).click();
    await expect(dialog.getByText("TTS (Edge-TTS)")).toBeVisible();

    await dialog.getByRole("button", { name: "MiMo TTS" }).click();
    await expect(dialog.getByText("TTS (MiMo)")).toBeVisible();
    await expect(dialog.getByPlaceholder("mimo-xxx...")).toBeVisible();

    await expectConfig(
      vault,
      (cfg) =>
        (cfg.ttsConfig as { provider?: string } | undefined)?.provider ===
        "mimo",
    );
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Test 7 — shortcut rebind works end-to-end and persists
// ---------------------------------------------------------------------------
test("rebinding the open-settings shortcut works and persists", async () => {
  const { app, window, vault } = await launchApp();
  try {
    const dialog = await openSettings(window);
    await dialog.getByRole("button", { name: "Shortcuts" }).click();

    // Find the "Open settings" row, start capture.
    const row = dialog
      .getByText("Open settings", { exact: true })
      .locator("..");
    await row.getByTitle("Change shortcut").click();
    await expect(row.getByText("(listening...)")).toBeVisible();

    // Press the new binding → row shows the formatted combo.
    await window.keyboard.press("Control+o");
    await expect(row.getByText("Ctrl+O")).toBeVisible();

    await expectConfig(
      vault,
      (cfg) =>
        (cfg.shortcuts as Record<string, string> | undefined)?.openSettings ===
        "ctrl+o",
    );

    // Functional proof: close the dialog (Escape), then the new shortcut
    // reopens it. The shortcut store update re-registers useShortcut with the
    // new key, so this is the same path a user exercises.
    await window.keyboard.press("Escape");
    await expect(window.locator('[role="dialog"]:visible')).not.toBeVisible();
    await window.keyboard.press("Control+o");
    // The modal keeps its active tab across close/reopen (the component stays
    // mounted; only the Radix dialog toggles), so it reopens on Shortcuts.
    const reopened = window.locator('[role="dialog"]:visible');
    await expect(reopened).toBeVisible();
    await expect(reopened.getByText("Keyboard Shortcuts")).toBeVisible();
  } finally {
    await app.close();
  }
});
