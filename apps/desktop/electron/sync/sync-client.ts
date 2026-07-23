/**
 * Sync HTTP client — authenticated fetch wrapper for the sync server.
 *
 * Runs in the Electron main process.
 *
 * Two levels of auth:
 *   serverToken — used ONLY for /api/auth/register (joining the server)
 *   deviceToken — used for all other requests (sync, verify)
 */

import type {
  SyncPushBody,
  SyncPushResponse,
  SyncPullBody,
  SyncPullResponse,
  AuthRegisterBody,
  AuthRegisterResponse,
  AuthVerifyResponse,
} from "@siltflow/shared-lib";

export class SyncClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "SyncClientError";
  }
}

export class SyncClient {
  private serverUrl: string;
  private serverToken: string;
  private deviceToken: string;

  constructor(serverUrl: string, serverToken: string, deviceToken: string) {
    this.serverUrl = serverUrl.replace(/\/+$/, "");
    this.serverToken = serverToken;
    this.deviceToken = deviceToken;
  }

  /** Update tokens at runtime. */
  setDeviceToken(token: string): void {
    this.deviceToken = token;
  }

  setServerToken(token: string): void {
    this.serverToken = token;
  }

  // ── Auth ──────────────────────────────────────────────────────────

  /** Register a device using the server token. */
  async authRegister(
    body: AuthRegisterBody,
  ): Promise<AuthRegisterResponse> {
    return this.post<AuthRegisterResponse>(
      "/api/auth/register", body, this.serverToken,
    );
  }

  async authVerify(): Promise<AuthVerifyResponse> {
    return this.post<AuthVerifyResponse>("/api/auth/verify");
  }

  // ── Sync ──────────────────────────────────────────────────────────

  async push(body: SyncPushBody): Promise<SyncPushResponse> {
    return this.post<SyncPushResponse>("/api/sync/push", body);
  }

  async pull(body: SyncPullBody): Promise<SyncPullResponse> {
    return this.post<SyncPullResponse>("/api/sync/pull", body);
  }

  // ── Internal ──────────────────────────────────────────────────────

  /**
   * POST with the device token as auth (default).
   * Pass an explicit authToken to override (used for /register with server token).
   */
  private async post<T>(
    path: string,
    body?: unknown,
    authToken?: string,
  ): Promise<T> {
    const token = authToken ?? this.deviceToken;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const res = await fetch(`${this.serverUrl}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new SyncClientError(
        (errBody as { error?: string }).error ?? `HTTP ${res.status}`,
        res.status,
      );
    }

    return res.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.serverUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.deviceToken}` },
    });
    if (!res.ok) {
      throw new SyncClientError(`HTTP ${res.status}`, res.status);
    }
    return res.json() as Promise<T>;
  }
}
