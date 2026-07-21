import { useState, useEffect } from "react";
import { Loader2, Download, ExternalLink } from "lucide-react";
import { useAppSettingsStore } from "@/stores/app.store";
import { Button } from "@/components/ui/button";

export function AboutContent() {
  const [updateState, setUpdateState] = useState<
    | "idle"
    | "checking"
    | "available"
    | "latest"
    | "downloading"
    | "downloaded"
    | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dbVersion, setDbVersion] = useState<number | null>(null);

  const checkUpdateOnStartup = useAppSettingsStore(
    (s) => s.checkUpdateOnStartup,
  );
  const setCheckUpdateOnStartup = useAppSettingsStore(
    (s) => s.setCheckUpdateOnStartup,
  );

  const currentVersion = __APP_VERSION__;
  const releasesUrl = "https://github.com/TYBLHQY/siltflow/releases";

  // Fetch DB schema version on mount
  useEffect(() => {
    window.siltflow.dbSchemaVersion().then(setDbVersion);
  }, []);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.siltflow.update.onAvailable((info: any) => {
        const tag = info?.version || info?.tag_name || "";
        setLatestVersion(tag.startsWith("v") ? tag.slice(1) : tag);
        setUpdateState("available");
      }),
    );

    unsubs.push(
      window.siltflow.update.onNotAvailable(() => {
        setLatestVersion(null);
        setUpdateState("latest");
      }),
    );

    unsubs.push(
      window.siltflow.update.onDownloadProgress((p) => {
        setProgress(p.percent);
        setUpdateState("downloading");
      }),
    );

    unsubs.push(
      window.siltflow.update.onDownloaded(() => {
        setUpdateState("downloaded");
      }),
    );

    unsubs.push(
      window.siltflow.update.onError((msg) => {
        setErrorMsg(msg);
        setUpdateState("error");
      }),
    );

    return () => unsubs.forEach((fn) => fn());
  }, []);

  const handleCheck = () => {
    setUpdateState("checking");
    setErrorMsg(null);
    // Dispatch event so App.tsx also opens the update dialog
    window.dispatchEvent(new CustomEvent("siltflow:check-updates"));
    window.siltflow.update.check();
  };

  const handleDownload = () => {
    setUpdateState("downloading");
    setProgress(0);
    window.siltflow.update.download();
  };

  const handleInstall = () => {
    window.siltflow.update.install();
  };

  return (
    <div className="space-y-5 pt-3">
      {/* App info */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Siltflow</h3>
        <p className="text-xs text-ctp-overlay0">
          A language learning document reader with spaced repetition and AI
          translation.
        </p>
      </div>

      {/* Version */}
      <div className="space-y-1">
        <label className="block text-xs font-medium">Current Version</label>
        <p className="text-sm">{currentVersion}</p>
      </div>

      {/* DB Schema Version */}
      {dbVersion !== null && (
        <div className="space-y-1">
          <label className="block text-xs font-medium">DB Schema Version</label>
          <p className="text-sm">{dbVersion}</p>
        </div>
      )}

      {/* Update */}
      <div className="space-y-2">
        <label className="block text-xs font-medium">Updates</label>

        {/* Auto-check toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="checkUpdateOnStartup"
            className="rounded"
            checked={checkUpdateOnStartup}
            onChange={(e) => setCheckUpdateOnStartup(e.target.checked)}
          />
          <label htmlFor="checkUpdateOnStartup" className="text-xs">
            Check for updates on startup
          </label>
        </div>

        {updateState === "checking" && (
          <div className="flex items-center gap-2 text-xs text-ctp-overlay0">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking for updates…
          </div>
        )}

        {updateState === "available" && (
          <div className="rounded-md border border-ctp-green/30 bg-ctp-green/10 px-3 py-2">
            <p className="text-xs font-medium text-ctp-green mb-1.5">
              v{latestVersion} is available
            </p>
            <Button size="sm" onClick={handleDownload}>
              <Download className="h-3 w-3" />
              Download Update
            </Button>
          </div>
        )}

        {updateState === "latest" && (
          <p className="text-xs text-ctp-overlay0">
            You are on the latest version.
          </p>
        )}

        {updateState === "downloading" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ctp-overlay0">Downloading…</span>
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

        {updateState === "downloaded" && (
          <div className="rounded-md border border-ctp-blue/30 bg-ctp-blue/10 px-3 py-2">
            <p className="text-xs font-medium text-ctp-blue mb-1.5">
              Update ready to install
            </p>
            <Button size="sm" onClick={handleInstall}>
              <Download className="h-3 w-3" />
              Restart &amp; Install
            </Button>
          </div>
        )}

        {updateState === "error" && (
          <div className="rounded-md border border-ctp-red/30 bg-ctp-red/10 px-3 py-2">
            <p className="text-xs font-medium text-ctp-red mb-1">
              Update check failed
            </p>
            <p className="text-xs text-ctp-red mb-1.5">{errorMsg}</p>
            <Button size="sm" onClick={handleCheck}>
              Retry
            </Button>
          </div>
        )}

        {updateState === "idle" && (
          <Button size="sm" onClick={handleCheck}>
            <Download className="h-3 w-3" />
            Check for Updates
          </Button>
        )}
      </div>

      {/* Dev: mock update dialog trigger */}
      {import.meta.env.DEV && (
        <div className="space-y-2">
          <label className="block text-xs font-medium">Dev Tools</label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("siltflow:check-updates"))
            }
          >
            Show Update Dialog
          </Button>
        </div>
      )}

      {/* View on GitHub */}
      <div className="pt-2">
        <a
          href={releasesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-ctp-mauve hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View all releases on GitHub
        </a>
      </div>
    </div>
  );
}
