/**
 * TTS configuration panel (mobile).
 *
 * Mirrors desktop `components/settings/TTSConfigContent.tsx` but:
 *  - No `binaryPath` — mobile goes through sync-server proxy.
 *  - Uses @react-native-community/slider for rate/volume/pitch.
 *  - Per-language voices use a bottom-sheet modal picker instead of <select>.
 */

import { useEffect, useState, useCallback } from "react";
import { Modal, TouchableWithoutFeedback } from "react-native";
import { View, Text, Pressable } from "@/tw";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Card, CardContent, Spinner } from "@/components/ui";
import { useTTSStore } from "@/stores/tts.store";

const LANG_META = [
  { id: "zh-CN", label: "简体中文" },
  { id: "en-US", label: "English (US)" },
  { id: "de-DE", label: "Deutsch" },
  { id: "ja-JP", label: "日本語" },
  { id: "fr-FR", label: "Français" },
  { id: "es-ES", label: "Español" },
] as const;

function parseSliderValue(raw: string): number {
  return parseInt(raw.replace(/[+%Hz]/g, ""), 10) || 0;
}

/** Voice display name: show last segment of the voice ID for readability. */
function voiceDisplayName(voiceId: string | undefined): string {
  if (!voiceId) return "auto";
  const parts = voiceId.split("-");
  return parts[parts.length - 1] ?? voiceId;
}

// ── Voice picker modal ──────────────────────────────────────────────

function VoicePickerSheet({
  visible,
  langId,
  current,
  voiceList,
  onSelect,
  onClose,
}: {
  visible: boolean;
  langId: string;
  current: string;
  voiceList: string[];
  onSelect: (voice: string) => void;
  onClose: () => void;
}) {
  const langLabel = LANG_META.find((l) => l.id === langId)?.label ?? langId;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View
            className="flex-1"
            style={{ backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          >
            <TouchableWithoutFeedback>
              <View className="rounded-t-2xl bg-ctp-base px-4 pt-4 pb-8" style={{ maxHeight: "75%" }}>
                <View className="items-center mb-3">
                  <View
                    className="w-10 rounded-full"
                    style={{ height: 4, backgroundColor: "rgba(128,128,128,0.4)" }}
                  />
                </View>

                <Text className="text-base font-semibold text-ctp-text mb-1 px-2">
                  {langLabel}
                </Text>
                <Text className="text-xs text-ctp-overlay0 mb-3 px-2">
                  Select a voice for this language
                </Text>

                {/* "auto" option */}
                <Pressable
                  onPress={() => {
                    onSelect("");
                    onClose();
                  }}
                  className="flex-row items-center justify-between px-4 py-3 rounded-lg active:bg-ctp-surface0"
                >
                  <Text
                    className={`text-base ${!current ? "font-semibold text-ctp-mauve" : "text-ctp-text"}`}
                  >
                    auto
                  </Text>
                  {!current ? (
                    <MaterialCommunityIcons name="check" size={20} color="#c4a1e0" />
                  ) : null}
                </Pressable>

                {voiceList.map((voice) => {
                  const selected = current === voice;
                  return (
                    <Pressable
                      key={voice}
                      onPress={() => {
                        onSelect(voice);
                        onClose();
                      }}
                      className="flex-row items-center justify-between px-4 py-3 rounded-lg active:bg-ctp-surface0"
                    >
                      <Text
                        className={`text-base flex-1 ${selected ? "font-semibold text-ctp-mauve" : "text-ctp-text"}`}
                        numberOfLines={2}
                      >
                        {voice}
                      </Text>
                      {selected ? (
                        <MaterialCommunityIcons name="check" size={20} color="#c4a1e0" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── TTS Config panel ───────────────────────────────────────────────

export function TTSConfig() {
  const config = useTTSStore((s) => s.config);
  const setConfig = useTTSStore((s) => s.setConfig);
  const refreshVoices = useTTSStore((s) => s.refreshVoices);
  const loadingVoices = useTTSStore((s) => s.loadingVoices);
  const voiceLists = useTTSStore.getState().voiceLists;

  const [pickerLang, setPickerLang] = useState<string | null>(null);

  const hasCachedLists = Object.keys(voiceLists).some(
    (k) => voiceLists[k]?.length > 0,
  );

  useEffect(() => {
    if (!hasCachedLists) {
      refreshVoices();
    }
  }, [hasCachedLists, refreshVoices]);

  const handleRefresh = useCallback(() => {
    refreshVoices();
  }, [refreshVoices]);

  const openPicker = useCallback((langId: string) => {
    setPickerLang(langId);
  }, []);

  const closePicker = useCallback(() => {
    setPickerLang(null);
  }, []);

  return (
    <View className="gap-4">
      {/* Header */}
      <View className="flex-row items-center gap-2">
        <Text className="text-lg font-semibold text-ctp-text">
          TTS (Edge-TTS)
        </Text>
      </View>

      <Card>
        <CardContent>
          <View className="gap-4 pt-3">
            {/* Rate slider */}
            <View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs font-medium text-ctp-subtext0">Rate</Text>
                <Text className="text-xs text-ctp-overlay0">{config.rate}</Text>
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
                <Text className="text-xs font-medium text-ctp-subtext0">Volume</Text>
                <Text className="text-xs text-ctp-overlay0">{config.volume}</Text>
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
                <Text className="text-xs font-medium text-ctp-subtext0">Pitch</Text>
                <Text className="text-xs text-ctp-overlay0">{config.pitch}</Text>
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
                <Pressable
                  onPress={handleRefresh}
                  disabled={loadingVoices}
                  className="flex-row items-center gap-1 active:opacity-70"
                >
                  {loadingVoices ? (
                    <Spinner size="sm" />
                  ) : (
                    <MaterialCommunityIcons name="refresh" size={14} color="#7b7f8a" />
                  )}
                </Pressable>
              </View>
              <View className="gap-1.5">
                {LANG_META.map((lang) => {
                  const current = config.perLanguageVoices[lang.id] ?? "";
                  return (
                    <Pressable
                      key={lang.id}
                      onPress={() => openPicker(lang.id)}
                      className="flex-row items-center justify-between rounded-md border border-ctp-surface1 bg-transparent px-3 py-2.5 active:bg-ctp-surface0"
                    >
                      <Text className="text-sm text-ctp-subtext0">{lang.label}</Text>
                      <View className="flex-row items-center gap-1">
                        <Text
                          className="text-sm text-ctp-text max-w-[200px]"
                          numberOfLines={1}
                        >
                          {voiceDisplayName(current)}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#7b7f8a" />
                      </View>
                    </Pressable>
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

      {/* Voice picker modal */}
      {pickerLang && (
        <VoicePickerSheet
          visible={pickerLang !== null}
          langId={pickerLang}
          current={config.perLanguageVoices[pickerLang] ?? ""}
          voiceList={voiceLists[pickerLang] ?? []}
          onSelect={(voice) => {
            setConfig({
              perLanguageVoices: {
                ...config.perLanguageVoices,
                [pickerLang]: voice,
              },
            });
          }}
          onClose={closePicker}
        />
      )}
    </View>
  );
}
