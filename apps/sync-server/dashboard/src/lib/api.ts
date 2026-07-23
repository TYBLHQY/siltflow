/**
 * API client — fetch wrapper that attaches the Bearer token from sessionStorage
 * and handles 401 responses by redirecting to /login.
 */

const TOKEN_KEY = "siltflow_token";

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    window.location.hash = "#/login";
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    clearToken();
    window.location.hash = "#/login";
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Delete failed: ${res.status}`);
  }
  // Some delete endpoints return JSON, some don't — parse if present
  const text = await res.text();
  try { return JSON.parse(text) as T; } catch { return undefined as unknown as T; }
}

// ── API Types ────────────────────────────────────────────────────────

export interface DeviceInfo {
  id: string;
  name: string;
  isAdmin: boolean;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface ServerSetting {
  key: string;
  value: string;
  updatedAt: string;
}

export interface RegisterResult {
  deviceId: string;
  deviceName: string;
  token: string;
  warning: string;
}

export interface HealthInfo {
  ok: boolean;
  uptime: number;
  db: string;
  timestamp: string;
}
