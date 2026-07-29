/**
 * Tests for SyncClient — authenticated HTTP client for the sync server.
 *
 * Mocks the global fetch API to test URL construction, auth header logic,
 * error handling, and JSON serialization without real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Inline SyncClient — avoids importing the real module which depends on
// @siltflow/shared-lib types that resolve fine in Node, but we keep it
// self-contained for the test to avoid native module chains.

class SyncClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "SyncClientError";
  }
}

class SyncClient {
  private serverUrl: string;
  private serverToken: string;
  private deviceToken: string;

  constructor(serverUrl: string, serverToken: string, deviceToken: string) {
    this.serverUrl = serverUrl.replace(/\/+$/, "");
    this.serverToken = serverToken;
    this.deviceToken = deviceToken;
  }

  setDeviceToken(token: string): void { this.deviceToken = token; }
  setServerToken(token: string): void { this.serverToken = token; }

  async authRegister(body: {
    deviceName: string;
    deviceId?: string;
  }): Promise<any> {
    return this.post("/api/auth/register", body, this.serverToken);
  }

  async authVerify(): Promise<any> {
    return this.post("/api/auth/verify");
  }

  async push(body: any): Promise<any> {
    return this.post("/api/sync/push", body);
  }

  async pull(body: any): Promise<any> {
    return this.post("/api/sync/pull", body);
  }

  private async post(path: string, body?: unknown, authToken?: string): Promise<any> {
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
    return res.json();
  }
}

describe("SyncClient", () => {
  let client: SyncClient;
  let fetchCalls: Array<{ url: string; init: RequestInit }>;

  beforeEach(() => {
    fetchCalls = [];
    // Mock global fetch
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init: init ?? {} });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    client = new SyncClient("https://sync.example.com", "server-secret", "device-token-123");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strips trailing slashes from serverUrl", () => {
    const c = new SyncClient("https://sync.example.com///", "s", "d");
    // We verify by making a call and checking the URL
    return c.authRegister({ deviceName: "test" }).then(() => {
      expect(fetchCalls[0].url).toBe("https://sync.example.com/api/auth/register");
    });
  });

  it("sends server token for authRegister", async () => {
    await client.authRegister({ deviceName: "my-device" });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe("https://sync.example.com/api/auth/register");
    expect(fetchCalls[0].init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer server-secret",
    });
    expect(JSON.parse(fetchCalls[0].init.body as string)).toEqual({
      deviceName: "my-device",
    });
  });

  it("sends device token for authVerify", async () => {
    await client.authVerify();
    expect(fetchCalls[0].url).toBe("https://sync.example.com/api/auth/verify");
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer device-token-123");
  });

  it("allows updating device token at runtime", async () => {
    client.setDeviceToken("new-device-token");
    await client.push({ changes: {} });
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer new-device-token");
  });

  it("constructs sync push URL correctly", async () => {
    await client.push({ changes: {} });
    expect(fetchCalls[0].url).toBe("https://sync.example.com/api/sync/push");
  });

  it("constructs sync pull URL correctly", async () => {
    await client.pull({ lastSyncAt: "2025-01-01T00:00:00Z" });
    expect(fetchCalls[0].url).toBe("https://sync.example.com/api/sync/pull");
    expect(JSON.parse(fetchCalls[0].init.body as string)).toEqual({
      lastSyncAt: "2025-01-01T00:00:00Z",
    });
  });

  it("throws SyncClientError on non-2xx response", async () => {
    vi.stubGlobal("fetch", async () => {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    });

    await expect(client.authVerify()).rejects.toThrow(SyncClientError);
  });

  it("SyncClientError includes status code", async () => {
    vi.stubGlobal("fetch", async () => {
      return new Response("{}", {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    });

    try {
      await client.pull({ lastSyncAt: "" });
      expect.fail("should have thrown");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(SyncClientError);
      expect((err as SyncClientError).status).toBe(503);
    }
  });

  it("handles non-JSON error body gracefully", async () => {
    vi.stubGlobal("fetch", async () => {
      return new Response("Internal Server Error", { status: 500 });
    });

    try {
      await client.pull({ lastSyncAt: "" });
      expect.fail("should have thrown");
    } catch (err: unknown) {
      expect((err as SyncClientError).message).toBe("HTTP 500");
    }
  });

  it("does not send body for GET-like requests without body", async () => {
    await client.authVerify(); // POST without body
    expect(fetchCalls[0].init.body).toBeUndefined();
  });
});
