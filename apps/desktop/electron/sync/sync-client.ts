/**
 * Sync HTTP client — authenticated fetch wrapper for the sync server.
 *
 * Runs in the Electron main process. All requests include an
 * Authorization: Bearer {token} header. Errors are thrown with the
 * server's error message when available.
 */

import type {
  SyncPushBody,
  SyncPushResponse,
  SyncPullBody,
  SyncPullResponse,
  AuthBootstrapBody,
  AuthBootstrapResponse,
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
  private token: string;

  constructor(serverUrl: string, token: string) {
    // Normalize: strip trailing slash
    this.serverUrl = serverUrl.replace(/\/+$/, "");
    this.token = token;
  }

  /** Update the token (e.g. after re-bootstrapping). */
  setToken(token: string): void {
    this.token = token;
  }

  // ── Auth ──────────────────────────────────────────────────────────

  async authBootstrap(
    body: AuthBootstrapBody,
  ): Promise<AuthBootstrapResponse> {
    return this.post<AuthBootstrapResponse>("/api/auth/bootstrap", body);
  }

  async authRegister(
    body: AuthRegisterBody,
  ): Promise<AuthRegisterResponse> {
    return this.post<AuthRegisterResponse>("/api/auth/register", body);
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

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
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

  /** Expose for one-off GET requests (e.g. health check). */
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.serverUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      throw new SyncClientError(`HTTP ${res.status}`, res.status);
    }
    return res.json() as Promise<T>;
  }
}
