# Sync Auth Model (v2)

## Two-tier token system

```
┌─────────────────────────────────────────────────────────┐
│                    Server Token                          │
│  - User-configured (copy-pasted from server admin UI)   │
│  - Hashes to match bootstrapToken in server config      │
│  - Used ONLY for device registration (/api/auth)        │
│  - Grants admin access to dashboard                     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ POST /api/auth/register
                          │   body: { deviceName, deviceId? }
                          │   header: Bearer <serverToken>
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Device Token                          │
│  - Returned by server after registration                │
│  - Unique per device (SHA-256 hashed in devices table)  │
│  - Used for ALL sync operations (push, pull, WS)        │
│  - Persisted in vault config / app_settings             │
└─────────────────────────────────────────────────────────┘
```

## Registration flow

1. User enters server URL + server token in Settings UI
2. Client calls `POST /api/auth/register` with `Bearer <serverToken>`
3. Server validates server token against `bootstrapToken` config
4. Server creates/updates device record, generates device token
5. Client stores `deviceId` + `deviceToken` locally
6. Subsequent requests use `Bearer <deviceToken>`

## Auth middleware

`apps/sync-server/src/auth/middleware.ts` — applied to all routes except
`/api/auth/*`:

```typescript
// 1. Check if token matches bootstrapToken → admin access
if (token === config.bootstrapToken) {
  c.set("deviceId", "server");
  c.set("isAdmin", true);
  return next();
}

// 2. Check device token hash against devices table
const hash = createHash("sha256").update(token).digest("hex");
const device = db.select().from(devices).where(eq(devices.tokenHash, hash)).get();
if (!device) return 401;

c.set("deviceId", device.id);
c.set("isAdmin", device.isAdmin);
```

## Token storage

| Platform | Location | Keys |
|---|---|---|
| Desktop | `{vault}/.siltflow/config.json` | `syncServerToken`, `syncDeviceToken`, `syncDeviceId` |
| Mobile | `app_settings` SQLite table | `sync:deviceToken`, `sync:deviceId` |

## Device re-registration

If the client already has a `deviceId` from a previous registration, it sends
it in the register request. The server re-uses the existing device record,
issues a new device token, and updates the device name (allowing renames).
This prevents duplicate device records when a client disconnects and reconnects.
The deviceId is permanent device identity — it survives disconnect cycles on
the client side.

## Server token in sync requests?

No. The desktop `SyncClient` sends:
- `Authorization: Bearer <deviceToken>` for sync operations
- `X-Server-Token: <serverToken>` header is NOT sent for sync

The server token is ONLY used for `/api/auth/register` and `/api/auth/verify`.

## File Map

| File | What |
|---|---|
| `apps/sync-server/src/auth/middleware.ts` | Bearer token validation |
| `apps/sync-server/src/routes/auth.ts` | Registration + verification endpoints |
| `apps/desktop/electron/sync/sync-client.ts` | Desktop HTTP client |
| `apps/mobile/src/sync/sync-client.ts` | Mobile HTTP client |
