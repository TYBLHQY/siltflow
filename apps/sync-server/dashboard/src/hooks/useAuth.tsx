/**
 * Auth hook — manages token, device info, and login/logout flow.
 *
 * On mount, re-verifies any stored token to validate the session.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiPost, setToken, clearToken } from "../lib/api";

interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  isAdmin: boolean;
}

interface AuthState {
  token: string | null;
  device: DeviceInfo | null;
  loading: boolean;
  error: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const TOKEN_KEY = "siltflow_token";
const DEVICE_KEY = "siltflow_device";

function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

function getStoredDevice(): DeviceInfo | null {
  try {
    const raw = sessionStorage.getItem(DEVICE_KEY);
    return raw ? (JSON.parse(raw) as DeviceInfo) : null;
  } catch {
    return null;
  }
}

function storeDevice(device: DeviceInfo): void {
  sessionStorage.setItem(DEVICE_KEY, JSON.stringify(device));
}

function clearDevice(): void {
  sessionStorage.removeItem(DEVICE_KEY);
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getStoredToken);
  const [device, setDevice] = useState<DeviceInfo | null>(getStoredDevice);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On mount, verify the stored token
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    apiPost<DeviceInfo>("/api/auth/verify")
      .then((d) => {
        setDevice(d);
        storeDevice(d);
      })
      .catch(() => {
        // Token invalid — clear everything
        clearToken();
        clearDevice();
        setTokenState(null);
        setDevice(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (t: string) => {
    setError(null);
    // Temporarily set token on the api client for this request only
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    };
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `Login failed: ${res.status}`);
    }
    const deviceInfo = (await res.json()) as DeviceInfo;
    setToken(t);
    setTokenState(t);
    setDevice(deviceInfo);
    storeDevice(deviceInfo);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    clearDevice();
    setTokenState(null);
    setDevice(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, device, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
