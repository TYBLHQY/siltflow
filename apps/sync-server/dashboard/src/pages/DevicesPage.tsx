/**
 * Devices page — device management table with register/revoke.
 *
 * Only visible to admin users. Shows all registered devices with
 * their last sync time, last seen time, and registration date.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { apiGet, apiPost, apiDelete, type DeviceInfo, type RegisterResult } from "../lib/api";
import { cn } from "../lib/utils";
import {
  Monitor,
  Plus,
  Trash2,
  Shield,
  User,
  RefreshCw,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

// ── Register Modal ────────────────────────────────────────────────────

function RegisterModal({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<RegisterResult>("/api/devices/register", {
        deviceName: trimmed,
      });
      setResult(res);
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.token) return;
    await navigator.clipboard.writeText(result.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName("");
    setError(null);
    setResult(null);
    setCopied(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-ctp-overlay0/30 bg-ctp-mantle p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Register Device</h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          /* Token display */
          <div className="space-y-4">
            <div className="rounded-lg border border-ctp-yellow/30 bg-ctp-yellow/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ctp-yellow">
                <AlertTriangle className="h-3.5 w-3.5" />
                {result.warning}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-ctp-crust px-3 py-2 text-xs text-ctp-text select-all">
                  {result.token}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg p-2 text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text"
                  title="Copy token"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-ctp-green" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs text-ctp-overlay0">
              Device: <span className="font-medium text-ctp-text">{result.deviceName}</span>
            </p>
            <button
              onClick={handleClose}
              className="w-full rounded-lg bg-ctp-surface0 py-2 text-sm font-medium text-ctp-text hover:bg-ctp-surface1"
            >
              Done
            </button>
          </div>
        ) : (
          /* Input form */
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="deviceName" className="text-xs font-medium text-ctp-overlay0">
                Device Name
              </label>
              <input
                id="deviceName"
                type="text"
                placeholder="e.g. iPhone 16"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full rounded-lg border border-ctp-overlay0/30 bg-ctp-base px-3 py-2.5 text-sm text-ctp-text placeholder:text-ctp-overlay0/50 focus:border-ctp-mauve/50 focus:ring-2 focus:ring-ctp-mauve/20"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-md bg-ctp-red/10 px-3 py-2 text-xs text-ctp-red">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ctp-mauve py-2.5 text-sm font-semibold text-ctp-crust transition-colors hover:bg-ctp-mauve/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {loading ? "Registering…" : "Register"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export function DevicesPage() {
  const { device: currentDevice } = useAuth();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setError(null);
    try {
      const data = await apiGet<DeviceInfo[]>("/api/devices");
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRevoke = async (deviceId: string) => {
    setRevoking(deviceId);
    try {
      await apiDelete(`/api/devices/${encodeURIComponent(deviceId)}`);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke device");
    } finally {
      setRevoking(null);
      setConfirmRevoke(null);
    }
  };

  const isAdmin = currentDevice?.isAdmin ?? false;

  // ── Render states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ctp-mauve" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Devices</h1>
          <p className="text-sm text-ctp-overlay0">
            {devices.length} registered device{devices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDevices}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-ctp-mauve px-4 py-2 text-sm font-semibold text-ctp-crust transition-colors hover:bg-ctp-mauve/90"
            >
              <Plus className="h-4 w-4" />
              Register
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-ctp-red/10 px-4 py-3 text-sm text-ctp-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && devices.length === 0 && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ctp-overlay0">
          <Monitor className="h-12 w-12 text-ctp-overlay0/40" />
          <p className="text-sm">No devices registered yet</p>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-ctp-mauve px-4 py-2 text-sm font-medium text-ctp-crust hover:bg-ctp-mauve/90"
            >
              <Plus className="h-4 w-4" />
              Register First Device
            </button>
          )}
        </div>
      )}

      {/* Device table */}
      {devices.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-ctp-overlay0/20">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ctp-overlay0/10 bg-ctp-mantle">
                <th className="px-4 py-3 text-left text-xs font-medium text-ctp-overlay0">
                  Device
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ctp-overlay0">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ctp-overlay0">
                  Last Sync
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ctp-overlay0">
                  Last Seen
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ctp-overlay0">
                  Registered
                </th>
                {isAdmin && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-ctp-overlay0">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const isSelf = d.id === currentDevice?.deviceId;
                const isRevoking = revoking === d.id;
                const isConfirming = confirmRevoke === d.id;

                return (
                  <tr
                    key={d.id}
                    className={cn(
                      "border-b border-ctp-overlay0/5 last:border-0",
                      isSelf && "bg-ctp-mauve/5",
                    )}
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 shrink-0 text-ctp-overlay0" />
                        <span className="text-sm font-medium">
                          {d.name}
                          {isSelf && (
                            <span className="ml-1.5 text-[10px] text-ctp-overlay0">
                              (you)
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          d.isAdmin
                            ? "bg-ctp-yellow/10 text-ctp-yellow"
                            : "bg-ctp-surface0 text-ctp-overlay0",
                        )}
                      >
                        {d.isAdmin ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                        {d.isAdmin ? "Admin" : "Member"}
                      </span>
                    </td>

                    {/* Last Sync */}
                    <td className="px-4 py-3">
                      <span
                        className="text-sm text-ctp-overlay0"
                        title={formatAbsolute(d.lastSyncAt)}
                      >
                        {formatRelative(d.lastSyncAt)}
                      </span>
                    </td>

                    {/* Last Seen */}
                    <td className="px-4 py-3">
                      <span
                        className="text-sm text-ctp-overlay0"
                        title={formatAbsolute(d.lastSeenAt)}
                      >
                        {formatRelative(d.lastSeenAt)}
                      </span>
                    </td>

                    {/* Registered */}
                    <td className="px-4 py-3">
                      <span
                        className="text-sm text-ctp-overlay0"
                        title={formatAbsolute(d.createdAt)}
                      >
                        {formatRelative(d.createdAt)}
                      </span>
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {isConfirming ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs text-ctp-red">
                              Confirm?
                            </span>
                            <button
                              onClick={() => handleRevoke(d.id)}
                              disabled={isRevoking}
                              className="rounded-md bg-ctp-red px-2 py-1 text-xs font-semibold text-ctp-crust hover:bg-ctp-red/80"
                            >
                              {isRevoking ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Yes"
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmRevoke(null)}
                              disabled={isRevoking}
                              className="rounded-md bg-ctp-surface0 px-2 py-1 text-xs text-ctp-text hover:bg-ctp-surface1"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRevoke(d.id)}
                            disabled={isSelf}
                            className={cn(
                              "rounded-lg p-1.5 transition-colors",
                              isSelf
                                ? "cursor-not-allowed text-ctp-overlay0/30"
                                : "text-ctp-overlay0 hover:bg-ctp-red/10 hover:text-ctp-red",
                            )}
                            title={isSelf ? "Cannot revoke your own token" : "Revoke token"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Modal */}
      <RegisterModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onRegistered={fetchDevices}
      />
    </div>
  );
}
