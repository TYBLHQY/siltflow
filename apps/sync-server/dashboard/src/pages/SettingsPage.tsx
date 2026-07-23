/**
 * Settings page — server info dashboard.
 *
 * Reads settings from GET /api/settings, health from GET /health.
 */

import { useState, useEffect, useCallback } from "react";
import { apiGet, type HealthInfo } from "../lib/api";
import { Server, Loader2, AlertTriangle } from "lucide-react";

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

export function SettingsPage() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const healthData = await apiGet<HealthInfo>("/health");
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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ctp-mauve" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-ctp-overlay0">Server configuration</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-ctp-red/10 px-4 py-3 text-sm text-ctp-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="max-w-2xl space-y-6">
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
