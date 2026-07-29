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
  Input,
  Button,
  Spinner,
} from "@/components/ui";
import { useTTSStore } from "@/stores/tts.store";

const LANG_META = [
  { id: "zh-CN", label: "简体中文" },
  { id: "en-US", label: "English (US)" },
  { id: "de-DE", label: "Deutsch" },
  { id: "ja-JP", label: "日本語" },
  { id: "fr-FR", label: "Français" },
  { id: "es-ES", label: "Español" },
] as const;

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
          TTS (Edge-TTS)
        </Text>
      </View>

      {/* ── Rate/Volume/Pitch + Voices ── */}
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
    </View>
  );
}
