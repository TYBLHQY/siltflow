import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, Loader2 } from "lucide-react";

interface VaultSetupProps {
  onReady: () => void;
}

export function VaultSetup({ onReady }: VaultSetupProps) {
  const [loading, setLoading] = useState(true);
  const [, setVaultPath] = useState("");

  useEffect(() => {
    window.siltflow.vaultGetPath().then((p) => {
      if (p) {
        setVaultPath(p);
        onReady();
      } else {
        setLoading(false);
      }
    });
  }, [onReady]);

  const handleSelect = async () => {
    setLoading(true);
    const path = await window.siltflow.vaultSelect();
    if (path) {
      setVaultPath(path);
      onReady();
    } else {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center px-4">
        <div className="rounded-full bg-accent p-4">
          <FolderOpen className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold mb-2">Welcome to Siltflow</h1>
          <p className="text-sm text-muted-foreground">
            Choose a vault directory to store your documents, annotations, and
            learning data. You can change this later in settings.
          </p>
        </div>
        <Button onClick={handleSelect} className="w-full">
          <FolderOpen className="mr-2 h-4 w-4" />
          Select Vault Directory
        </Button>
      </div>
    </div>
  );
}
