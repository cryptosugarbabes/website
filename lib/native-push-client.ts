const TOKEN_KEY = "crypto_sugar_android_push_token";

export function rememberNativePushToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export async function unregisterNativePushDevice() {
  const token = window.sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    await fetch("/api/push/devices", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token })
    }).catch(() => null);
  }
  window.CryptoSugarAndroid?.disablePushNotifications();
  window.sessionStorage.removeItem(TOKEN_KEY);
}
