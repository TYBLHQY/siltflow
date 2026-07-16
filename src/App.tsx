import { useState, useEffect, useCallback } from "react";
import { VaultSetup } from "@/components/layout/VaultSetup";
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { loadFromVault, useAIStore } from "@/stores/ai.store";
import { loadFSRSParams } from "@/stores/fsrs.store";
import { loadSummariesFromVault } from "@/stores/summary.store";
import {
  loadStyleFromVault,
  useStyleStore,
  buildFontStack,
} from "@/stores/style.store";
import { loadTTSConfigFromVault } from "@/stores/tts.store";
import { useToastStore } from "@/stores/toast.store";
import { loadShortcutsFromVault } from "@/stores/shortcuts.store";
import { loadLastPages } from "@/stores/pdf-viewer.store";
import { loadThemeFromVault, useThemeStore } from "@/stores/theme.store";
import {
  loadAppSettingsFromVault,
  useAppSettingsStore,
} from "@/stores/app.store";
import { Toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function App() {
  const [vaultReady, setVaultReady] = useState(false);
  const aiLoaded = useAIStore((s) => s.loaded);
  const showToast = useToastStore((s) => s.show);
  const appSettingsLoaded = useAppSettingsStore((s) => s.loaded);
  const checkUpdateOnStartup = useAppSettingsStore(
    (s) => s.checkUpdateOnStartup,
  );
  const setCheckUpdateOnStartup = useAppSettingsStore(
    (s) => s.setCheckUpdateOnStartup,
  );

  const [updateDialog, setUpdateDialog] = useState<
    { latestVersion: string } | "checking" | "latest" | "error" | null
  >(null);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (vaultReady && !aiLoaded) {
      // Single vaultConfigGet call, distribute to all loaders (1 IPC instead of 9)
      window.siltflow.vaultConfigGet().then((cfg) => {
        loadFromVault(cfg);
        loadFSRSParams(cfg);
        loadSummariesFromVault();
        loadStyleFromVault(cfg);
        loadTTSConfigFromVault(cfg);
        loadShortcutsFromVault(cfg);
        loadLastPages(cfg);
        loadThemeFromVault(cfg);
        loadAppSettingsFromVault(cfg);
      });
    }
  }, [vaultReady, aiLoaded]);

  // Intercept <a target="_blank"> clicks → open in system browser
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest?.("a");
      if (!anchor?.href || anchor.target !== "_blank") return;
      // Skip blob: and javascript: URLs
      if (
        anchor.href.startsWith("blob:") ||
        anchor.href.startsWith("javascript:")
      )
        return;
      e.preventDefault();
      window.siltflow.openExternal(anchor.href);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Check for updates on startup if enabled (skip in dev mode)
  useEffect(() => {
    if (!vaultReady || !appSettingsLoaded || !checkUpdateOnStartup) return;
    if (import.meta.env.DEV) return;

    const timer = setTimeout(() => {
      setUpdateDialog("checking");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unsubAvailable = window.siltflow.update.onAvailable((info: any) => {
        const tag = info?.version || info?.tag_name || "";
        setUpdateDialog({
          latestVersion: tag.startsWith("v") ? tag.slice(1) : tag,
        });
      });
      const unsubNotAvail = window.siltflow.update.onNotAvailable(() => {
        setUpdateDialog("latest");
      });
      const unsubProgress = window.siltflow.update.onDownloadProgress((p) => {
        setProgress(p.percent);
      });
      const unsubDownloaded = window.siltflow.update.onDownloaded(() => {
        setDownloaded(true);
        setDownloading(false);
      });
      const unsubError = window.siltflow.update.onError(() => {
        setUpdateDialog("error");
      });

      window.siltflow.update.check();

      return () => {
        unsubAvailable();
        unsubNotAvail();
        unsubProgress();
        unsubDownloaded();
        unsubError();
      };
    }, 1500);

    return () => clearTimeout(timer);
  }, [vaultReady, appSettingsLoaded, checkUpdateOnStartup]);

  // Show toast on mount if no profiles
  useEffect(() => {
    if (aiLoaded && useAIStore.getState().profiles.length === 0) {
      showToast(
        "No AI provider configured — go to Settings > AI Config",
        "info",
      );
    }
  }, [aiLoaded, showToast]);

  // Apply global font size and system font to <html> element
  const globalFontSize = useStyleStore((s) => s.style.globalFontSize);
  const systemFontFamilies = useStyleStore((s) => s.style.systemFontFamilies);
  const systemFontStack = buildFontStack(systemFontFamilies);
  useEffect(() => {
    document.documentElement.style.fontSize = `${globalFontSize}px`;
  }, [globalFontSize]);
  useEffect(() => {
    document.documentElement.style.fontFamily = systemFontStack;
  }, [systemFontStack]);

  // ── Theme application ────────────────────────────────────────────────
  const themeConfig = useThemeStore((s) => s.config);
  const resolveTheme = useThemeStore((s) => s.resolveTheme);

  const applyTheme = useCallback(() => {
    const resolved = resolveTheme();
    const html = document.documentElement;

    // Remove all flavor classes
    html.classList.remove(
      "latte",
      "frappe",
      "macchiato",
      "mocha",
    );

    // Add the resolved flavor class
    html.classList.add(resolved.flavor);

    // Sync .dark class for shadcn compatibility
    html.classList.toggle("dark", resolved.isDark);

    // Apply PDF dark invert
    html.dataset.pdfDarkInvert = themeConfig.pdfDarkInvert ? "true" : "false";
  }, [resolveTheme, themeConfig.pdfDarkInvert]);

  // Apply on config change
  useEffect(() => {
    applyTheme();
  }, [
    applyTheme,
    themeConfig.themeMode,
    themeConfig.lightTheme,
    themeConfig.darkTheme,
  ]);

  // Listen for OS color scheme changes in auto mode
  useEffect(() => {
    if (themeConfig.themeMode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeConfig.themeMode, applyTheme]);

  const handleReady = () => {
    setVaultReady(true);
  };

  if (!vaultReady) {
    return <VaultSetup onReady={handleReady} />;
  }

  return (
    <>
      <Toast />
      <ThreeColumnLayout />

      {/* ── Update dialog (startup check) ── */}
      <Dialog
        open={
          updateDialog !== null &&
          updateDialog !== "checking" &&
          updateDialog !== "latest"
        }
        onOpenChange={() => setUpdateDialog(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Available</DialogTitle>
            <DialogDescription>
              {/* eslint-disable @typescript-eslint/no-explicit-any */}
              {downloaded
                ? `Version ${(updateDialog as any)?.latestVersion} has been downloaded and is ready to install.`
                : `Version ${(updateDialog as any)?.latestVersion} is available.`}
              {/* eslint-enable @typescript-eslint/no-explicit-any */}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 px-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ctp-overlay0">Current version</span>
              <span className="font-medium">
                {__APP_VERSION__.startsWith("v")
                  ? __APP_VERSION__
                  : `v${__APP_VERSION__}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ctp-overlay0">New version</span>
              <span className="font-medium text-ctp-green">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              v{(updateDialog as any)?.latestVersion}
              </span>
            </div>
            <button
              onClick={() =>
                /* eslint-disable @typescript-eslint/no-explicit-any */
                window.siltflow.openExternal(
                  `https://github.com/TYBLHQY/siltflow/releases/tag/v${(updateDialog as any)?.latestVersion}`,
                )
                /* eslint-enable @typescript-eslint/no-explicit-any */
              }
              className="block text-xs text-ctp-mauve hover:underline mt-1"
            >
              View release notes →
            </button>
          </div>

          {/* Auto-check toggle */}
          <div className="flex items-center gap-2 px-2 pb-1">
            <input
              type="checkbox"
              id="autoCheckToggle"
              className="rounded"
              checked={checkUpdateOnStartup}
              onChange={() => setCheckUpdateOnStartup(!checkUpdateOnStartup)}
            />
            <label
              htmlFor="autoCheckToggle"
              className="text-xs text-ctp-overlay0"
            >
              Check for updates on startup
            </label>
          </div>

          {downloading && (
            <div className="space-y-1 px-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ctp-overlay0">
                  Downloading…
                </span>
                <span className="text-xs text-ctp-overlay0">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ctp-surface0">
                <div
                  className="h-full rounded-full bg-ctp-mauve transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col items-start gap-3">
            {downloaded ? (
              <Button
                className="w-full"
                onClick={() => window.siltflow.update.install()}
              >
                Restart &amp; Install
              </Button>
            ) : downloading ? (
              <span className="text-xs text-ctp-overlay0">
                Downloading…
              </span>
            ) : (
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setUpdateDialog(null);
                    setDownloaded(false);
                    setDownloading(false);
                    setProgress(0);
                  }}
                >
                  Later
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setDownloading(true);
                    window.siltflow.update.download();
                  }}
                >
                  <Download className="h-4 w-4 inline mr-1" />
                  Download
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default App;
