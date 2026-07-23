/**
 * Settings page — server configuration and toggles.
 *
 * Shows PDF sync toggle (admin-only writable) and server info.
 * Reads settings from GET /api/settings, health from GET /health.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { apiGet, apiPatch, type ServerSetting, type HealthInfo } from "../lib/api";
import { Settings, FileText, Server, Loader2, AlertTriangle } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

// ── Toggle Switch ─────────────────────────────────────────────────────

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-ctp-green" : "bg-ctp-overlay0/30"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export function SettingsPage() {
  const { device } = useAuth();
  const isAdmin = device?.isAdmin ?? false;

  const [settings, setSettings] = useState<ServerSetting[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [settingsData, healthData] = await Promise.all([
        apiGet<ServerSetting[]>("/api/settings"),
        apiGet<HealthInfo>("/health"),
      ]);
      setSettings(settingsData);
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSetting = (key: string): ServerSetting | undefined =>
    settings.find((s) => s.key === key);

  const handleToggle = async (key: string, newValue: string) => {
    setSaving(true);
    try {
      const updated = await apiPatch<ServerSetting>("/api/settings", {
        key,
        value: newValue,
      });
      setSettings((prev) => prev.map((s) => (s.key === key ? updated : s)));
    } catch {
      // Revert on failure
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  // ── Render states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ctp-mauve" />
      </div>
    );
  }

  const pdfSync = getSetting("pdf_sync_enabled");
  const pdfSyncEnabled = pdfSync?.value === "true";

  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-ctp-overlay0">Server configuration</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-ctp-red/10 px-4 py-3 text-sm text-ctp-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* PDF Sync toggle */}
        <div className="rounded-xl border border-ctp-overlay0/20 bg-ctp-mantle p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ctp-blue/10">
                <FileText className="h-4 w-4 text-ctp-blue" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">PDF File Sync</h2>
                <p className="mt-0.5 text-xs text-ctp-overlay0">
                  When enabled, devices can upload PDF files to the server.
                  Disable to save storage space and bandwidth.
                </p>
                {!isAdmin && (
                  <p className="mt-1 text-[11px] text-ctp-overlay0/60">
                    Only admins can change this setting.
                  </p>
                )}
              </div>
            </div>
            <ToggleSwitch
              enabled={pdfSyncEnabled}
              onChange={(v) => handleToggle("pdf_sync_enabled", v ? "true" : "false")}
              disabled={!isAdmin || saving}
            />
          </div>
          {pdfSync && (
            <p className="mt-3 text-[11px] text-ctp-overlay0/60">
              Last changed: {new Date(pdfSync.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Server Info */}
        {health && (
          <div className="rounded-xl border border-ctp-overlay0/20 bg-ctp-mantle p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ctp-green/10">
                <Server className="h-4 w-4 text-ctp-green" />
              </div>
              <h2 className="text-sm font-semibold">Server Info</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-ctp-base px-3 py-2.5">
                <p className="text-[10px] font-medium text-ctp-overlay0 uppercase tracking-wide">
                  Status
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      health.ok ? "bg-ctp-green" : "bg-ctp-red"
                    }`}
                  />
                  {health.ok ? "Online" : "Offline"}
                </p>
              </div>
              <div className="rounded-lg bg-ctp-base px-3 py-2.5">
                <p className="text-[10px] font-medium text-ctp-overlay0 uppercase tracking-wide">
                  Database
                </p>
                <p className="mt-0.5 text-sm capitalize">{health.db}</p>
              </div>
              <div className="rounded-lg bg-ctp-base px-3 py-2.5">
                <p className="text-[10px] font-medium text-ctp-overlay0 uppercase tracking-wide">
                  Uptime
                </p>
                <p className="mt-0.5 text-sm">{formatUptime(health.uptime)}</p>
              </div>
              <div className="rounded-lg bg-ctp-base px-3 py-2.5">
                <p className="text-[10px] font-medium text-ctp-overlay0 uppercase tracking-wide">
                  Last Check
                </p>
                <p className="mt-0.5 text-sm">
                  {new Date(health.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
