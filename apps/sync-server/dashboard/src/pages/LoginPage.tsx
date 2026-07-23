import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { BrainCircuit, Key, Loader2 } from "lucide-react";

export function LoginPage() {
  const { login, token: currentToken } = useAuth();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already logged in — redirect (must be in useEffect, not during render)
  useEffect(() => {
    if (currentToken) {
      navigate("/overview", { replace: true });
    }
  }, [currentToken, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setError(null);
    setLoading(true);
    try {
      await login(trimmed);
      navigate("/overview", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ctp-base p-4">
      <div className="w-full max-w-sm rounded-xl border border-ctp-overlay0/30 bg-ctp-mantle p-8 shadow-lg">
        {/* Logo + Title */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ctp-mauve/15">
            <BrainCircuit className="h-6 w-6 text-ctp-mauve" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">SiltFlow Dashboard</h1>
          <p className="text-xs text-ctp-overlay0">Enter the server token or a device token to sign in</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="token" className="text-xs font-medium text-ctp-overlay0">
              Bearer Token
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ctp-overlay0" />
              <input
                id="token"
                type="password"
                placeholder="Server token or device token…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-lg border border-ctp-overlay0/30 bg-ctp-base py-2.5 pl-9 pr-3 text-sm text-ctp-text placeholder:text-ctp-overlay0/50 focus:border-ctp-mauve/50 focus:ring-2 focus:ring-ctp-mauve/20"
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-ctp-red/10 px-3 py-2 text-xs text-ctp-red">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ctp-mauve py-2.5 text-sm font-semibold text-ctp-crust transition-colors hover:bg-ctp-mauve/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {loading ? "Verifying…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
