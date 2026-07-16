import { useEffect } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { useTTSStore, MIMO_PRESET_VOICES, MIMO_MODELS } from "@/stores/tts.store";

export function TTSConfigContent() {
  const config = useTTSStore((s) => s.config);
  const setConfig = useTTSStore((s) => s.setConfig);
  const refreshVoices = useTTSStore((s) => s.refreshVoices);
  const loadingVoices = useTTSStore((s) => s.loadingVoices);
  const voiceLists = useTTSStore((s) => s.config.voiceLists);
  const hasCachedLists = Object.keys(voiceLists).some(
    (k) => voiceLists[k].length > 0,
  );

  // Auto-fetch voice list on first open if not cached
  useEffect(() => {
    if (!hasCachedLists) {
      refreshVoices();
    }
  }, [hasCachedLists, refreshVoices]);

  const langMeta = [
    { id: "zh", label: "简体中文" },
    { id: "en", label: "English" },
    { id: "de", label: "Deutsch" },
    { id: "ja", label: "日本語" },
    { id: "fr", label: "Français" },
    { id: "es", label: "Español" },
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Volume2 className="h-5 w-5" />
        <h2 className="text-base font-semibold">
          TTS{config.provider === "mimo" ? " (MiMo)" : " (Edge-TTS)"}
        </h2>
      </div>

      <div className="space-y-4">

        {/* Provider selector */}
        <div>
          <label className="block text-xs font-medium mb-1">Provider</label>
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                config.provider === "edge-tts"
                  ? "bg-ctp-mauve text-ctp-crust"
                  : "border border-ctp-overlay0/50 text-ctp-overlay0 hover:bg-ctp-surface0"
              }`}
              onClick={() => setConfig({ provider: "edge-tts" })}
            >
              Edge-TTS
            </button>
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                config.provider === "mimo"
                  ? "bg-ctp-mauve text-ctp-crust"
                  : "border border-ctp-overlay0/50 text-ctp-overlay0 hover:bg-ctp-surface0"
              }`}
              onClick={() => setConfig({ provider: "mimo" })}
            >
              MiMo TTS
            </button>
          </div>
        </div>

        {/* ── Edge-TTS settings ── */}
        {config.provider === "edge-tts" && (
          <>
            {/* Binary path */}
            <div>
              <label className="block text-xs font-medium mb-1">
                Binary path
              </label>
              <input
                className="w-full rounded-md border bg-ctp-base px-3 py-1.5 text-xs"
                value={config.binaryPath}
                onChange={(e) => setConfig({ binaryPath: e.target.value })}
                placeholder="edge-tts (via PATH)"
              />
              <p className="text-xs text-ctp-overlay0 mt-0.5">
                Absolute path or leave empty to search via PATH.
              </p>
            </div>

            {/* Rate / Volume / Pitch */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Rate: {config.rate}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={parseInt(config.rate.replace(/[+%]/g, ""))}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const sign = v >= 0 ? "+" : "";
                    setConfig({ rate: `${sign}${v}%` });
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Volume: {config.volume}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={parseInt(config.volume.replace(/[+%]/g, ""))}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const sign = v >= 0 ? "+" : "";
                    setConfig({ volume: `${sign}${v}%` });
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Pitch: {config.pitch}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={parseInt(config.pitch.replace(/[+Hz]/g, ""))}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    const sign = v >= 0 ? "+" : "";
                    setConfig({ pitch: `${sign}${v}Hz` });
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Per-language voices */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium">
                  Voices (per language)
                </label>
                <button
                  className="flex items-center gap-1 text-xs text-ctp-overlay0 hover:text-ctp-text disabled:opacity-50"
                  onClick={() => refreshVoices()}
                  disabled={loadingVoices}
                  title="Refresh voice list from edge-tts --list-voices"
                >
                  {loadingVoices ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                    </svg>
                  )}
                  Refresh
                </button>
              </div>
              <div className="space-y-1.5">
                {langMeta.map((lang) => {
                  const list = config.voiceLists[lang.id];
                  const current = config.perLanguageVoices[lang.id] ?? "";
                  return (
                    <div key={lang.id} className="flex items-center gap-2">
                      <span className="text-xs w-16 shrink-0">
                        {lang.label}
                      </span>
                      {list && list.length > 0 ? (
                        <select
                          className="flex-1 rounded-md border bg-ctp-base px-2 py-1 text-xs"
                          value={list.includes(current) ? current : ""}
                          onChange={(e) =>
                            setConfig({
                              perLanguageVoices: {
                                ...config.perLanguageVoices,
                                [lang.id]: e.target.value,
                              },
                            })
                          }
                        >
                          {current && !list.includes(current) && (
                            <option value={current}>{current}</option>
                          )}
                          {list.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="flex-1 rounded-md border bg-ctp-base px-2 py-1 text-xs"
                          value={current}
                          onChange={(e) =>
                            setConfig({
                              perLanguageVoices: {
                                ...config.perLanguageVoices,
                                [lang.id]: e.target.value,
                              },
                            })
                          }
                          placeholder="auto"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-ctp-overlay0">
              Requires <code>pip install edge-tts</code> · Voices provided by
              Microsoft Edge online TTS.
            </p>
          </>
        )}

        {/* ── MiMo settings ── */}
        {config.provider === "mimo" && (
          <>
            {/* API Key */}
            <div>
              <label className="block text-xs font-medium mb-1">API Key</label>
              <input
                type="password"
                className="w-full rounded-md border bg-ctp-base px-3 py-1.5 text-xs"
                value={config.mimoApiKey}
                onChange={(e) => setConfig({ mimoApiKey: e.target.value })}
                placeholder="mimo-xxx..."
              />
              <p className="text-xs text-ctp-overlay0 mt-0.5">
                Get your API key from{" "}
                <a
                  className="underline"
                  href="https://mimo.mi.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  mimo.mi.com
                </a>
              </p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium mb-1">Model</label>
              <select
                className="w-full rounded-md border bg-ctp-base px-3 py-1.5 text-xs"
                value={config.mimoModel}
                onChange={(e) => setConfig({ mimoModel: e.target.value })}
              >
                {MIMO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice */}
            <div>
              <label className="block text-xs font-medium mb-1">Voice</label>
              <select
                className="w-full rounded-md border bg-ctp-base px-3 py-1.5 text-xs"
                value={
                  MIMO_PRESET_VOICES.some((v) => v.id === config.mimoVoice)
                    ? config.mimoVoice
                    : "custom"
                }
                onChange={(e) => {
                  if (e.target.value === "custom") return;
                  setConfig({ mimoVoice: e.target.value });
                }}
              >
                {MIMO_PRESET_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
                {!MIMO_PRESET_VOICES.some((v) => v.id === config.mimoVoice) && (
                  <option value="custom">{config.mimoVoice}</option>
                )}
              </select>
              {/* Custom voice input */}
              {!MIMO_PRESET_VOICES.some((v) => v.id === config.mimoVoice) && (
                <input
                  className="mt-1 w-full rounded-md border bg-ctp-base px-3 py-1.5 text-xs"
                  value={config.mimoVoice}
                  onChange={(e) => setConfig({ mimoVoice: e.target.value })}
                  placeholder="Custom voice ID"
                />
              )}
            </div>

            {/* Style prompt */}
            <div>
              <label className="block text-xs font-medium mb-1">
                Style prompt{" "}
                <span className="text-xs text-ctp-overlay0 font-normal">
                  (tone description)
                </span>
              </label>
              <textarea
                className="w-full rounded-md border bg-ctp-base px-3 py-1.5 text-xs resize-none"
                rows={2}
                value={config.mimoStylePrompt}
                onChange={(e) => setConfig({ mimoStylePrompt: e.target.value })}
                placeholder="e.g. Bright, bouncy tone."
              />
              <p className="text-xs text-ctp-overlay0 mt-0.5">
                Sent as a <code>user</code> message before the text. Use{" "}
                <strong>Director Mode</strong> for detailed control:{" "}
                <code>{"【角色】... 【场景】... 【指导】..."}</code>
              </p>
            </div>

            {/* Inline audio tag */}
            <div>
              <label className="block text-xs font-medium mb-1">
                Inline tag{" "}
                <span className="text-xs text-ctp-overlay0 font-normal">
                  (prepended to text)
                </span>
              </label>
              <input
                className="w-full rounded-md border bg-ctp-base px-3 py-1.5 text-xs"
                value={config.mimoInlineTag}
                onChange={(e) => setConfig({ mimoInlineTag: e.target.value })}
                placeholder="e.g. (温柔) or (紧张，深呼吸)"
              />
              <p className="text-xs text-ctp-overlay0 mt-0.5">
                Wrap in parentheses. Examples: <code>(开心)</code>{" "}
                <code>(颤抖)</code> <code>(轻声笑)</code>.
              </p>
              <details className="mt-1">
                <summary className="text-xs text-ctp-overlay0 cursor-pointer hover:text-ctp-text">
                  Quick tags
                </summary>
                <div className="mt-1 flex flex-wrap gap-1">
                  {[
                    "开心",
                    "悲伤",
                    "愤怒",
                    "温柔",
                    "活泼",
                    "严肃",
                    "慵懒",
                    "俏皮",
                    "紧张",
                    "激动",
                    "疲惫",
                    "委屈",
                    "撒娇",
                    "害怕",
                    "颤抖",
                    "气声",
                    "鼻音",
                    "沙哑",
                    "轻笑",
                    "哽咽",
                    "抽泣",
                    "吸气",
                    "深呼吸",
                    "叹气",
                    "喘息",
                  ].map((tag) => (
                    <button
                      key={tag}
                      className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                        config.mimoInlineTag === `(${tag})`
                          ? "bg-ctp-mauve text-ctp-crust"
                          : "bg-ctp-surface0 text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-text"
                      }`}
                      onClick={() =>
                        setConfig({
                          mimoInlineTag:
                            config.mimoInlineTag === `(${tag})`
                              ? ""
                              : `(${tag})`,
                        })
                      }
                    >
                      ({tag})
                    </button>
                  ))}
                </div>
              </details>
            </div>

            <p className="text-xs text-ctp-overlay0">
              Powered by XiaoMi MiMo API ·{" "}
              <a
                className="underline"
                href="https://mimo.mi.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                mimo.mi.com
              </a>
            </p>
          </>
        )}
      </div>
    </>
  );
}
