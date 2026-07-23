/**
 * SearchBar — rounded search input with icon affordances.
 *
 * Used at the top of the Documents screen for instant local filtering.
 * Uses Unicode glyphs instead of SVG icons to avoid react-native-svg
 * native-module linking issues on the New Architecture.
 */

import { View, TextInput, Pressable, Text } from "@/tw";

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search documents...",
}: SearchBarProps) {
  return (
    <View className="flex-row items-center rounded-full bg-ctp-mantle px-3 py-2">
      {/* magnifying-glass glyph */}
      <Text className="text-sm text-ctp-overlay1">🔍</Text>
      <TextInput
        className="ml-2 flex-1 bg-transparent text-sm text-ctp-text"
        placeholder={placeholder}
        placeholderTextColor="#6e6c7a"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")} className="p-0.5">
          <Text className="text-sm text-ctp-overlay1">✕</Text>
        </Pressable>
      )}
    </View>
  );
}
