import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/LoginPage";
import { Layout } from "./pages/Layout";
import { BrainCircuit } from "lucide-react";

/** Placeholder overview page — will be replaced later. */
function OverviewPage() {
  const { device } = useAuth();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <BrainCircuit className="h-12 w-12 text-ctp-mauve/50" />
      <h1 className="text-xl font-semibold">Welcome, {device?.deviceName ?? "User"}</h1>
      <p className="text-sm text-ctp-overlay0">
        Dashboard is initialised. Stats pages coming soon.
      </p>
    </div>
  );
}

/** Route guard — redirects to /login if not authenticated. */
function AuthGuard() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ctp-mauve border-t-transparent" />
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route path="/overview" element={<OverviewPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
