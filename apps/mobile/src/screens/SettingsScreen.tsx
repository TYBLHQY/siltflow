import { useState } from "react";
import SyncScreen from "../sync/SyncScreen";
import { useAIStore, BUILTIN_PROVIDERS } from "../stores/ai.store";
import { useFSRSStore } from "../stores/fsrs.store";
import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsScreen() {
  const [showSync, setShowSync] = useState(false);
  const profiles = useAIStore((s) => s.profiles);
  const activeProfile = useAIStore(
    (s) => s.profiles.find((p) => p.active) ?? s.profiles[0] ?? null,
  );
  const params = useFSRSStore((s) => s.params);

  return (
    <div className="p-4 pb-2">
      <h1 className="text-lg font-semibold text-foreground mb-4">Settings</h1>

      <div className="space-y-4">
        {/* Sync */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Sync</h2>
          {showSync ? (
            <SyncScreen />
          ) : (
            <button
              onClick={() => setShowSync(true)}
              className="w-full py-2 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              Sync with Desktop
            </button>
          )}
        </section>

        {/* AI Provider */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">AI Provider</h2>
          {profiles.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              <p>No AI provider configured.</p>
              <p className="text-xs mt-1">Add one in the desktop app to enable translations.</p>
            </div>
          ) : (
            <div className="text-sm text-foreground">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active:</span>
                <span>{activeProfile?.name ?? "None"}</span>
              </div>
            </div>
          )}
        </section>

        {/* FSRS Parameters */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Review Settings</h2>
          <div className="text-sm space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <span>Retention target</span>
              <span className="text-foreground">{Math.round((params.request_retention ?? 0.85) * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Max interval</span>
              <span className="text-foreground">{params.maximum_interval ?? 365}d</span>
            </div>
          </div>
        </section>

        {/* App info */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">About</h2>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Siltflow Mobile v0.1.0</p>
            <p>Powered by Capacitor + React</p>
          </div>
        </section>
      </div>
    </div>
  );
}
