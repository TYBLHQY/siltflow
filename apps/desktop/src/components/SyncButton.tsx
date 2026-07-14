/**
 * Sync button for the desktop toolbar.
 * Shows sync server status and lets user start/stop the server.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Copy, Check } from "lucide-react";
import { useSyncServer } from "@/hooks/useSync";

interface SyncButtonProps {
  /** Won't show until vault is configured */
  vaultReady?: boolean;
}

export function SyncButton({ vaultReady }: SyncButtonProps) {
  const { status, starting, error, start, stop } = useSyncServer();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ips, setIps] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load local IPs on mount
  useEffect(() => {
    window.siltflow.getNetworkIPs().then(setIps).catch(() => {});
  }, []);

  // Close panel on click outside
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  const handleToggle = useCallback(async () => {
    if (status.running) {
      await stop();
      setExpanded(false);
    } else {
      await start();
    }
  }, [status, start, stop]);

  const handleCopy = useCallback(async () => {
    const displayIps = ips.length > 0 ? ips : ["localhost"];
    const text = `IP: ${displayIps[0]}\nPort: ${status.port}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [ips, status.port]);

  if (!vaultReady) return null;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant={status.running ? "default" : "ghost"}
        size="icon"
        className={`h-6 w-6 ${status.running ? "bg-green-600 hover:bg-green-700" : ""}`}
        onClick={() => status.running ? setExpanded(!expanded) : handleToggle()}
        title={status.running ? "Sync server running" : "Start sync server"}
        disabled={starting}
      >
        {status.running ? (
          <Wifi className="h-3.5 w-3.5 text-white" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
      </Button>

      {expanded && status.running && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border bg-popover p-3 shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-semibold text-green-600">Sync Server Active</span>
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            {ips.length > 0 ? (
              ips.map((ip) => (
                <div key={ip} className="flex justify-between">
                  <span>LAN IP:</span>
                  <code className="font-mono text-foreground">{ip}</code>
                </div>
              ))
            ) : null}
            <div className="flex justify-between">
              <span>Port:</span>
              <code className="font-mono text-foreground">{status.port}</code>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              {copied ? "Copied" : "Copy IP"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={handleToggle}
            >
              Stop Server
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border bg-destructive/10 p-2 text-xs text-destructive shadow-md">
          {error}
        </div>
      )}
    </div>
  );
}
