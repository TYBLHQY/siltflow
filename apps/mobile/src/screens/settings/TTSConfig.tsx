/**
 * TTS configuration panel (mobile).
 *
 * Mirrors desktop `components/settings/TTSConfigContent.tsx` but:
 *  - No `binaryPath` — mobile goes through sync-server proxy.
 *  - Uses @react-native-community/slider for rate/volume/pitch (RN has no <input type=range>).
 *  - Uses MaterialCommunityIcons from @expo/vector-icons for icons.
 */

import { useEffect } from "react";
import { View, Text } from "@/tw";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Button,
  Spinner,
} from "@/components/ui";
import {
  useTTSStore,
  MIMO_PRESET_VOICES,
  MIMO_MODELS,
} from "@/stores/tts.store";

const LANG_META = [
  { id: "zh-CN", label: "简体中文" },
  { id: "en-US", label: "English (US)" },
  { id: "de-DE", label: "Deutsch" },
  { id: "ja-JP", label: "日本語" },
  { id: "fr-FR", label: "Français" },
  { id: "es-ES", label: "Español" },
] as const;

const QUICK_TAGS = [
  "开心", "悲伤", "愤怒", "温柔", "活泼", "严肃",
  "慵懒", "俏皮", "紧张", "激动", "疲惫", "委屈",
  "撒娇", "害怕", "颤抖", "气声", "鼻音", "沙哑",
  "轻笑", "哽咽", "抽泣", "吸气", "深呼吸", "叹气", "喘息",
];

/** Parse a rate/volume/pitch string like "+10%" or "+0Hz" into a slider number. */
function parseSliderValue(raw: string): number {
  return parseInt(raw.replace(/[+%Hz]/g, ""), 10) || 0;
}

export function TTSConfig() {
  const config = useTTSStore((s) => s.config);
  const setConfig = useTTSStore((s) => s.setConfig);
  const refreshVoices = useTTSStore((s) => s.refreshVoices);
  const loadingVoices = useTTSStore((s) => s.loadingVoices);
  const voiceLists = useTTSStore.getState().voiceLists;

  const hasCachedLists = Object.keys(voiceLists).some(
    (k) => voiceLists[k]?.length > 0,
  );

  // Auto-fetch voice list on first open if not cached
  useEffect(() => {
    if (!hasCachedLists) {
      refreshVoices();
    }
  }, [hasCachedLists, refreshVoices]);

  const isEdge = config.provider === "edge-tts";

  return (
    <View className="gap-4">
      {/* Header */}
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons
          name="volume-high"
          size={20}
          color="#c4a1e0"
        />
        <Text className="text-lg font-semibold text-ctp-text">
          TTS{isEdge ? " (Edge-TTS)" : " (MiMo)"}
        </Text>
      </View>

      {/* ── Provider selector ── */}
      <View className="flex-row gap-2">
        <Button
          variant={isEdge ? "default" : "outline"}
          size="sm"
          onPress={() => setConfig({ provider: "edge-tts" })}
          className="flex-1"
        >
          Edge-TTS
        </Button>
        <Button
          variant={!isEdge ? "default" : "outline"}
          size="sm"
          onPress={() => setConfig({ provider: "mimo" })}
          className="flex-1"
        >
          MiMo TTS
        </Button>
      </View>

      {/* ── Edge-TTS settings ── */}
      {isEdge && (
        <Card>
          <CardContent>
            <View className="gap-4 pt-3">
              {/* Rate slider */}
              <View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs font-medium text-ctp-subtext0">
                    Rate
                  </Text>
                  <Text className="text-xs text-ctp-overlay0">
                    {config.rate}
                  </Text>
                </View>
                <Slider
                  minimumValue={-50}
                  maximumValue={50}
                  step={1}
                  value={parseSliderValue(config.rate)}
                  onValueChange={(v) => {
                    const sign = v >= 0 ? "+" : "";
                    setConfig({ rate: `${sign}${v}%` });
                  }}
                  minimumTrackTintColor="#c4a1e0"
                  maximumTrackTintColor="rgba(128,128,128,0.3)"
                  thumbTintColor="#c4a1e0"
                />
              </View>

              {/* Volume slider */}
              <View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs font-medium text-ctp-subtext0">
                    Volume
                  </Text>
                  <Text className="text-xs text-ctp-overlay0">
                    {config.volume}
                  </Text>
                </View>
                <Slider
                  minimumValue={-50}
                  maximumValue={50}
                  step={1}
                  value={parseSliderValue(config.volume)}
                  onValueChange={(v) => {
                    const sign = v >= 0 ? "+" : "";
                    setConfig({ volume: `${sign}${v}%` });
                  }}
                  minimumTrackTintColor="#c4a1e0"
                  maximumTrackTintColor="rgba(128,128,128,0.3)"
                  thumbTintColor="#c4a1e0"
                />
              </View>

              {/* Pitch slider */}
              <View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs font-medium text-ctp-subtext0">
                    Pitch
                  </Text>
                  <Text className="text-xs text-ctp-overlay0">
                    {config.pitch}
                  </Text>
                </View>
                <Slider
                  minimumValue={-50}
                  maximumValue={50}
                  step={1}
                  value={parseSliderValue(config.pitch)}
                  onValueChange={(v) => {
                    const sign = v >= 0 ? "+" : "";
                    setConfig({ pitch: `${sign}${v}Hz` });
                  }}
                  minimumTrackTintColor="#c4a1e0"
                  maximumTrackTintColor="rgba(128,128,128,0.3)"
                  thumbTintColor="#c4a1e0"
                />
              </View>

              {/* Per-language voices */}
              <View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-medium text-ctp-subtext0">
                    Voices (per language)
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => refreshVoices()}
                    disabled={loadingVoices}
                  >
                    {loadingVoices ? (
                      <Spinner size="sm" />
                    ) : (
                      <MaterialCommunityIcons
                        name="refresh"
                        size={14}
                        color="#7b7f8a"
                      />
                    )}
                  </Button>
                </View>
                <View className="gap-2">
                  {LANG_META.map((lang) => {
                    const list = voiceLists[lang.id];
                    const current =
                      config.perLanguageVoices[lang.id] ?? "";
                    return (
                      <View key={lang.id}>
                        <Text className="text-xs text-ctp-overlay0 mb-0.5">
                          {lang.label}
                        </Text>
                        <Input
                          value={current}
                          onChangeText={(v) =>
                            setConfig({
                              perLanguageVoices: {
                                ...config.perLanguageVoices,
                                [lang.id]: v,
                              },
                            })
                          }
                          placeholder="auto"
                        />
                      </View>
                    );
                  })}
                </View>
              </View>

              <Text className="text-xs text-ctp-overlay0">
                Voices provided by Microsoft Edge online TTS.
              </Text>
            </View>
          </CardContent>
        </Card>
      )}

      {/* ── MiMo settings ── */}
      {!isEdge && (
        <Card>
          <CardContent>
            <View className="gap-4 pt-3">
              {/* API Key */}
              <View>
                <Text className="text-xs font-medium text-ctp-subtext0 mb-1">
                  API Key
                </Text>
                <Input
                  value={config.mimoApiKey}
                  onChangeText={(v) => setConfig({ mimoApiKey: v })}
                  placeholder="mimo-xxx..."
                  secureTextEntry
                />
                <Text className="text-xs text-ctp-overlay0 mt-0.5">
                  Get your key from mimo.mi.com
                </Text>
              </View>

              {/* Model */}
              <View>
                <Text className="text-xs font-medium text-ctp-subtext0 mb-1">
                  Model
                </Text>
                {/* Use Button row as pseudo-select (mobile has no <select>) */}
                <View className="flex-row flex-wrap gap-1.5">
                  {MIMO_MODELS.map((m) => (
                    <Button
                      key={m.id}
                      variant={
                        config.mimoModel === m.id ? "default" : "outline"
                      }
                      size="sm"
                      onPress={() => setConfig({ mimoModel: m.id })}
                    >
                      <Text
                        className={`text-xs ${config.mimoModel === m.id ? "text-ctp-crust" : "text-ctp-text"}`}
                        numberOfLines={1}
                      >
                        {m.id}
                      </Text>
                    </Button>
                  ))}
                </View>
              </View>

              {/* Voice */}
              <View>
                <Text className="text-xs font-medium text-ctp-subtext0 mb-1">
                  Voice
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {MIMO_PRESET_VOICES.map((v) => (
                    <Button
                      key={v.id}
                      variant={
                        config.mimoVoice === v.id ? "default" : "outline"
                      }
                      size="sm"
                      onPress={() => setConfig({ mimoVoice: v.id })}
                    >
                      <Text
                        className={`text-xs ${config.mimoVoice === v.id ? "text-ctp-crust" : "text-ctp-text"}`}
                        numberOfLines={1}
                      >
                        {v.id}
                      </Text>
                    </Button>
                  ))}
                </View>
                {!MIMO_PRESET_VOICES.some(
                  (v) => v.id === config.mimoVoice,
                ) && (
                  <Input
                    className="mt-1.5"
                    value={config.mimoVoice}
                    onChangeText={(v) => setConfig({ mimoVoice: v })}
                    placeholder="Custom voice ID"
                  />
                )}
              </View>

              {/* Style prompt */}
              <View>
                <Text className="text-xs font-medium text-ctp-subtext0 mb-1">
                  Style prompt
                  <Text className="text-ctp-overlay0 font-normal">
                    {" "}
                    (tone description)
                  </Text>
                </Text>
                <Input
                  value={config.mimoStylePrompt}
                  onChangeText={(v) =>
                    setConfig({ mimoStylePrompt: v })
                  }
                  placeholder="e.g. Bright, bouncy tone."
                  multiline
                />
              </View>

              {/* Inline audio tag */}
              <View>
                <Text className="text-xs font-medium text-ctp-subtext0 mb-1">
                  Inline tag
                  <Text className="text-ctp-overlay0 font-normal">
                    {" "}
                    (prepended to text)
                  </Text>
                </Text>
                <Input
                  value={config.mimoInlineTag}
                  onChangeText={(v) =>
                    setConfig({ mimoInlineTag: v })
                  }
                  placeholder='e.g. (温柔) or (紧张，深呼吸)'
                />
                <Text className="text-xs text-ctp-overlay0 mt-0.5">
                  Wrap in parentheses. Examples: (开心) (颤抖) (轻笑).
                </Text>
              </View>

              {/* Quick tags */}
              <View>
                <Text className="text-xs font-medium text-ctp-subtext0 mb-1.5">
                  Quick tags
                </Text>
                <View className="flex-row flex-wrap gap-1">
                  {QUICK_TAGS.map((tag) => {
                    const isActive =
                      config.mimoInlineTag === `(${tag})`;
                    return (
                      <Button
                        key={tag}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onPress={() =>
                          setConfig({
                            mimoInlineTag: isActive
                              ? ""
                              : `(${tag})`,
                          })
                        }
                      >
                        <Text
                          className={`text-xs ${isActive ? "text-ctp-crust" : "text-ctp-text"}`}
                        >
                          ({tag})
                        </Text>
                      </Button>
                    );
                  })}
                </View>
              </View>

              <Text className="text-xs text-ctp-overlay0">
                Powered by XiaoMi MiMo API · mimo.mi.com
              </Text>
            </View>
          </CardContent>
        </Card>
      )}
    </View>
  );
}
