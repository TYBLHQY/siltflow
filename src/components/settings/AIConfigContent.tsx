import { useState } from "react";
import { Bot } from "lucide-react";
import { useAIStore, BUILTIN_PROVIDERS } from "@/stores/ai.store";
import { LANGUAGES } from "@/lib/languages";

export function AIConfigContent() {
  const profiles = useAIStore((s) => s.profiles);
  const addProfile = useAIStore((s) => s.addProfile);
  const removeProfile = useAIStore((s) => s.removeProfile);
  const updateProfile = useAIStore((s) => s.updateProfile);
  const setActiveProfile = useAIStore((s) => s.setActiveProfile);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // All built-in providers not yet configured
  const usedKeys = new Set(profiles.map((p) => p.providerKey));
  const availableProviders = BUILTIN_PROVIDERS.filter(
    (p: { key: string; editable?: boolean }) =>
      !usedKeys.has(p.key) || p.editable,
  );

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-5 w-5" />
        <h2 className="text-base font-semibold">AI Providers</h2>
      </div>

      {/* Profile list */}
      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`rounded-md border p-3 transition-colors ${
              profile.active ? "border-ctp-mauve" : ""
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {renameId === profile.id ? (
                  <input
                    className="w-40 rounded border bg-ctp-base px-2 py-0.5 text-sm"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                      if (renameValue.trim()) {
                        updateProfile(profile.id, { name: renameValue.trim() });
                      }
                      setRenameId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (renameValue.trim()) {
                          updateProfile(profile.id, {
                            name: renameValue.trim(),
                          });
                        }
                        setRenameId(null);
                      }
                      if (e.key === "Escape") setRenameId(null);
                    }}
                  />
                ) : (
                  <span className="text-sm font-medium truncate">
                    {profile.name}
                  </span>
                )}
                <span className="text-xs text-ctp-overlay0 uppercase">
                  {profile.providerKey}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!profile.active && (
                  <button
                    className="text-xs text-ctp-mauve hover:underline"
                    onClick={() => setActiveProfile(profile.id)}
                  >
                    Activate
                  </button>
                )}
                <button
                  className="text-xs text-ctp-overlay0 hover:text-ctp-text"
                  onClick={() => {
                    setRenameId(profile.id);
                    setRenameValue(profile.name);
                  }}
                >
                  Rename
                </button>
                <button
                  className="text-xs text-ctp-red hover:underline"
                  onClick={() => removeProfile(profile.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Config fields */}
            {editingId === profile.id ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-xs text-ctp-overlay0 mb-0.5">
                      Base URL
                    </label>
                    <input
                      className="w-full rounded border bg-ctp-base px-2 py-1 text-xs"
                      value={profile.baseUrl}
                      onChange={(e) =>
                        updateProfile(profile.id, { baseUrl: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ctp-overlay0 mb-0.5">
                      Model
                    </label>
                    <input
                      className="w-full rounded border bg-ctp-base px-2 py-1 text-xs"
                      value={profile.model}
                      onChange={(e) =>
                        updateProfile(profile.id, { model: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="block text-xs text-ctp-overlay0 mb-0.5">
                    API Key
                  </label>
                  <input
                    type="password"
                    className="w-full rounded border bg-ctp-base px-2 py-1 text-xs"
                    value={profile.apiKey}
                    onChange={(e) =>
                      updateProfile(profile.id, { apiKey: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-ctp-overlay0 mb-0.5">
                      Temperature
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      className="w-full"
                      value={profile.temperature}
                      onChange={(e) =>
                        updateProfile(profile.id, {
                          temperature: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ctp-overlay0 mb-0.5">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded border bg-ctp-base px-2 py-1 text-xs"
                      value={profile.maxTokens}
                      onChange={(e) =>
                        updateProfile(profile.id, {
                          maxTokens: parseInt(e.target.value, 10) || 512,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ctp-overlay0 mb-0.5">
                      Top P
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      className="w-full"
                      value={profile.topP}
                      onChange={(e) =>
                        updateProfile(profile.id, {
                          topP: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex gap-2 text-xs text-ctp-overlay0">
                <span className="truncate">{profile.baseUrl}</span>
                <span>·</span>
                <span>{profile.model}</span>
              </div>
            )}

            {/* Toggle config edit */}
            <button
              className="mt-1 text-xs text-ctp-overlay0 hover:text-ctp-text"
              onClick={() =>
                setEditingId(editingId === profile.id ? null : profile.id)
              }
            >
              {editingId === profile.id ? "Collapse" : "Edit params"}
            </button>
          </div>
        ))}
      </div>

      {/* Add provider */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ctp-mauve hover:underline">
          + Add provider
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {availableProviders.map(
            (provider: { key: string; label: string }) => (
              <button
                key={provider.key}
                className="rounded-md border bg-ctp-base px-2.5 py-1 text-xs transition-colors hover:bg-ctp-surface0"
                onClick={() => {
                  addProfile(provider.key);
                }}
              >
                {provider.label}
              </button>
            ),
          )}
        </div>
      </details>

      {/* Default target language */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs font-medium">Default target language</label>
        </div>
        <select
          className="w-full rounded-md border bg-ctp-base px-3 py-1.5 text-xs"
          value={useAIStore.getState().defaultTargetLang}
          onChange={(e) =>
            useAIStore.getState().setDefaultTargetLang(e.target.value)
          }
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <p className="text-xs text-ctp-overlay0 mt-0.5">
          Used for AI translation when no per-document override is set.
        </p>
      </div>
    </>
  );
}
