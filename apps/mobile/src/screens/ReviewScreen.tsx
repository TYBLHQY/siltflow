import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import StudyScreen from "./StudyScreen";

/**
 * Review tab — delegates to the StudyScreen's document selector.
 */
export default function ReviewScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top"]}>
      <StudyScreen />
    </SafeAreaView>
  );
}
