import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { initDatabase } from "./database";
import { bootStores, useDocumentStore, useFolderStore } from "./stores";
import TabBar from "./components/TabBar";
import DocumentListScreen from "./screens/DocumentListScreen";
import StudyScreen from "./screens/StudyScreen";
import ReviewScreen from "./screens/ReviewScreen";
import StatsScreen from "./screens/StatsScreen";
import SettingsScreen from "./screens/SettingsScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await bootStores();
        await Promise.all([
          useDocumentStore.getState().loadFromDb(),
          useFolderStore.getState().loadFolders(),
        ]);
        setReady(true);
      } catch (err: any) {
        console.error("[App] boot error:", err);
        setError(err?.message ?? String(err));
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-destructive text-base font-medium mb-2">Failed to initialize</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading Siltflow Mobile…</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="bg-background text-foreground" style={{ paddingBottom: '56px' }}>
        <Routes>
          <Route path="/documents" element={<DocumentListScreen />} />
          <Route path="/study" element={<StudyScreen />} />
          <Route path="/review" element={<ReviewScreen />} />
          <Route path="/stats" element={<StatsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/documents" replace />} />
        </Routes>
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '56px', zIndex: 100 }}>
          <TabBar />
        </div>
      </div>
    </HashRouter>
  );
}
