import React, { useEffect, useState, useCallback } from "react";
import { SyncClient } from "./client";
import { configGetAll, configSet } from "../config";

const CONFIG_KEY = "syncAddress";

interface SyncCounts {
  documents?: number;
  annotations?: number;
  aiResults?: number;
  fsrsCards?: number;
  reviewLogs?: number;
  summaries?: number;
}

export default function SyncScreen() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("53891");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ pull?: SyncCounts; push?: { pushed: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load previously saved address
  useEffect(() => {
    (async () => {
      const config = await configGetAll();
      const saved = config[CONFIG_KEY];
      if (saved) {
        const [h, p] = saved.split(":");
        setHost(h);
        if (p) setPort(p);
      }
    })();
  }, []);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    const client = new SyncClient(host, parseInt(port, 10));
    const ok = await client.checkConnection();
    setConnected(ok);
    if (!ok) {
      setError("Could not connect to server. Check the host/port and ensure the desktop sync is running.");
    } else {
      await configSet(CONFIG_KEY, `${host}:${port}`);
    }
    setConnecting(false);
  }, [host, port]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setResult(null);
    const client = new SyncClient(host, parseInt(port, 10));
    try {
      const res = await client.fullSync();
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? "Sync failed");
    }
    setSyncing(false);
  }, [host, port]);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Sync with Desktop</h2>

      {/* Server address */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Desktop IP address</label>
        <input
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
          placeholder="e.g. 192.168.1.100"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Port</label>
        <input
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
          placeholder="53891"
          value={port}
          onChange={(e) => setPort(e.target.value)}
        />
      </div>

      <button
        onClick={handleConnect}
        disabled={connecting || !host}
        className="w-full py-2 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
      >
        {connecting ? "Connecting…" : connected ? "✓ Connected" : "Connect"}
      </button>

      {connected && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full py-2 rounded-md bg-secondary text-secondary-foreground font-medium disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Start Sync"}
        </button>
      )}

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2 p-3 rounded-md bg-muted/50 text-sm text-foreground">
          <h3 className="font-medium">Sync Complete</h3>
          {result.pull && (
            <div>
              <p className="text-muted-foreground mb-1">Pulled from desktop:</p>
              <ul className="space-y-0.5 pl-4 list-disc">
                {Object.entries(result.pull).map(([key, val]) => (
                  <li key={key}>{key}: {val}</li>
                ))}
              </ul>
            </div>
          )}
          {result.push && (
            <p className="text-muted-foreground">
              Pushed to desktop: {result.push.pushed} items
            </p>
          )}
        </div>
      )}
    </div>
  );
}
