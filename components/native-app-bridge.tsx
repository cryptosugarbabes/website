"use client";

import { useEffect } from "react";
import { rememberNativePushToken } from "@/lib/native-push-client";

type PushTokenDetail = { token?: string; platform?: string; appVersion?: string };

export function NativeAppBridge() {
  useEffect(() => {
    let pendingToken: PushTokenDetail | null = null;

    async function syncToken(detail: PushTokenDetail) {
      if (!detail.token || detail.platform !== "ANDROID") return;
      pendingToken = detail;
      const response = await fetch("/api/push/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(detail)
      }).catch(() => null);
      if (response?.ok) {
        rememberNativePushToken(detail.token);
        pendingToken = null;
      }
    }

    function onToken(event: Event) {
      const detail = (event as CustomEvent<PushTokenDetail>).detail;
      void syncToken(detail || {});
    }

    window.addEventListener("crypto-sugar:push-token", onToken);
    window.CryptoSugarAndroid?.refreshPushToken();
    const retry = window.setInterval(() => {
      if (pendingToken) void syncToken(pendingToken);
    }, 15_000);
    return () => {
      window.removeEventListener("crypto-sugar:push-token", onToken);
      window.clearInterval(retry);
    };
  }, []);
  return null;
}
