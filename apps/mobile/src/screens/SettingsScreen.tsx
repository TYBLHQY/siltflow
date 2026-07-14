import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAIStore } from "../stores/ai.store";
import { useFSRSStore } from "../stores/fsrs.store";
import SyncScreen from "../sync/SyncScreen";

export default function SettingsScreen() {
  const profiles = useAIStore((s) => s.profiles);
  const activeProfile = useAIStore((s) => s.activeProfile());
  const params = useFSRSStore((s) => s.params);
  const [showSync, setShowSync] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* AI Section */}
        <Text style={styles.sectionTitle}>AI Provider</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Active Profile</Text>
          <Text style={styles.cardValue}>
            {activeProfile?.name ?? "None configured"}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Configured Profiles</Text>
          <Text style={styles.cardValue}>{profiles.length}</Text>
        </View>

        {/* FSRS Section */}
        <Text style={styles.sectionTitle}>FSRS (SRS Parameters)</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Request Retention</Text>
          <Text style={styles.cardValue}>
            {(params.request_retention * 100).toFixed(0)}%
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Maximum Interval</Text>
          <Text style={styles.cardValue}>
            {params.maximum_interval} days
          </Text>
        </View>

        {/* Appearance */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Theme</Text>
          <Text style={styles.cardValue}>Catppuccin Mocha</Text>
        </View>

        {/* Sync */}
        <Text style={styles.sectionTitle}>Sync</Text>
        <TouchableOpacity style={styles.syncBtn} onPress={() => setShowSync(true)}>
          <Text style={styles.syncBtnText}>Sync with Desktop</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Sync Modal */}
      <Modal visible={showSync} animationType="slide">
        <View style={{ flex: 1 }}>
          <Pressable
            style={styles.closeSyncBtn}
            onPress={() => setShowSync(false)}
          >
            <Text style={styles.closeSyncText}>✕ Close Sync</Text>
          </Pressable>
          <SyncScreen />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  scroll: { padding: 16 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
    color: "#333",
  },
  card: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  cardLabel: { fontSize: 13, color: "#888", marginBottom: 2 },
  cardValue: { fontSize: 16, color: "#333", fontWeight: "600" },
  syncBtn: {
    backgroundColor: "#4a90d9",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  syncBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  closeSyncBtn: {
    position: "absolute",
    top: 50,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  closeSyncText: { fontSize: 16, color: "#4a90d9", fontWeight: "600" },
});
