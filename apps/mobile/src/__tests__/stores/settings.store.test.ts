/**
 * Tests for settings store — pure Zustand store with no native dependencies.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore, type AIProfile } from "@/stores/settings.store";

function makeProfile(id: string, name: string): AIProfile {
  return {
    id,
    name,
    providerKey: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1,
  };
}

describe("useSettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      aiProfiles: [],
      defaultTargetLang: "zh-CN",
      hasCompletedOnboarding: false,
      animation: "default",
    });
  });

  it("starts with default values", () => {
    const s = useSettingsStore.getState();
    expect(s.aiProfiles).toEqual([]);
    expect(s.defaultTargetLang).toBe("zh-CN");
    expect(s.hasCompletedOnboarding).toBe(false);
    expect(s.animation).toBe("default");
  });

  describe("AI profiles", () => {
    it("addAIProfile appends a profile", () => {
      const profile = makeProfile("p1", "GPT-4");
      useSettingsStore.getState().addAIProfile(profile);

      const { aiProfiles } = useSettingsStore.getState();
      expect(aiProfiles).toHaveLength(1);
      expect(aiProfiles[0].name).toBe("GPT-4");
    });

    it("setAIProfiles replaces all profiles", () => {
      useSettingsStore.getState().addAIProfile(makeProfile("p1", "A"));
      useSettingsStore.getState().setAIProfiles([
        makeProfile("p2", "B"),
        makeProfile("p3", "C"),
      ]);
      expect(useSettingsStore.getState().aiProfiles).toHaveLength(2);
      expect(useSettingsStore.getState().aiProfiles[0].name).toBe("B");
    });

    it("updateAIProfile patches specific fields", () => {
      useSettingsStore.getState().addAIProfile(makeProfile("p1", "Old Name"));
      useSettingsStore.getState().updateAIProfile("p1", {
        name: "New Name",
        temperature: 0.5,
      });
      const updated = useSettingsStore.getState().aiProfiles[0];
      expect(updated.name).toBe("New Name");
      expect(updated.temperature).toBe(0.5);
      expect(updated.model).toBe("gpt-4"); // unchanged
    });

    it("updateAIProfile is a no-op for unknown id", () => {
      useSettingsStore.getState().updateAIProfile("nonexistent", { name: "X" });
      expect(useSettingsStore.getState().aiProfiles).toHaveLength(0);
    });

    it("removeAIProfile deletes by id", () => {
      useSettingsStore.getState().addAIProfile(makeProfile("keep", "Keep"));
      useSettingsStore.getState().addAIProfile(makeProfile("del", "Delete"));
      expect(useSettingsStore.getState().aiProfiles).toHaveLength(2);

      useSettingsStore.getState().removeAIProfile("del");
      expect(useSettingsStore.getState().aiProfiles).toHaveLength(1);
      expect(useSettingsStore.getState().aiProfiles[0].id).toBe("keep");
    });
  });

  describe("settings", () => {
    it("setDefaultTargetLang updates language", () => {
      useSettingsStore.getState().setDefaultTargetLang("ja-JP");
      expect(useSettingsStore.getState().defaultTargetLang).toBe("ja-JP");
    });

    it("setHasCompletedOnboarding updates flag", () => {
      useSettingsStore.getState().setHasCompletedOnboarding(true);
      expect(useSettingsStore.getState().hasCompletedOnboarding).toBe(true);
    });

    it("setAnimation updates animation type", () => {
      useSettingsStore.getState().setAnimation("fade");
      expect(useSettingsStore.getState().animation).toBe("fade");
    });
  });
});
