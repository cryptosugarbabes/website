import { createSign } from "node:crypto";
import { query } from "./db";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type AccessToken = { value: string; expiresAt: number };
type DeviceRow = { token: string };

let cachedAccessToken: AccessToken | null = null;

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed as ServiceAccount;
  } catch {
    return null;
  }
}

export function pushNotificationsConfigured() {
  return Boolean(serviceAccount());
}

export function validAndroidPushToken(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 32
    && value.length <= 4096
    && /^[A-Za-z0-9_:.-]+$/.test(value);
}

async function accessToken(account: ServiceAccount) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key).toString("base64url")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const payload = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !payload?.access_token) throw new Error(`FCM OAuth failed with status ${response.status}.`);
  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(300, payload.expires_in || 3600) * 1000
  };
  return cachedAccessToken.value;
}

async function sendToDevice(account: ServiceAccount, bearer: string, token: string, path: string) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearer}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      message: {
        token,
        data: { type: "PRIVATE_MESSAGE", path },
        android: { priority: "high" }
      }
    })
  });
  if (response.ok) return true;
  const errorBody = await response.text();
  if (errorBody.includes("UNREGISTERED") || errorBody.includes("registration-token-not-registered")) {
    await query(`DELETE FROM app_push_devices WHERE token = $1`, [token]);
    return false;
  }
  throw new Error(`FCM send failed with status ${response.status}.`);
}

export async function sendPrivateMessagePush(recipientUserId: string) {
  const account = serviceAccount();
  if (!account) return { configured: false, delivered: 0 };
  const devices = await query<DeviceRow>(`
    SELECT token FROM app_push_devices
    WHERE user_id = $1 AND platform = 'ANDROID' AND enabled = TRUE
    ORDER BY last_seen_at DESC
  `, [recipientUserId]);
  if (!devices.rowCount) return { configured: true, delivered: 0 };

  const bearer = await accessToken(account);
  const results = await Promise.allSettled(
    devices.rows.map((device) => sendToDevice(account, bearer, device.token, "/dashboard#messages"))
  );
  const delivered = results.filter((result) => result.status === "fulfilled" && result.value).length;
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) throw new Error(`FCM delivery failed for ${failed.length} device(s).`);
  return { configured: true, delivered };
}
