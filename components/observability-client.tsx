"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { reportBrowserError, trackProductEvent } from "@/lib/client-observability";

export function ObservabilityClient() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/dashboard")) {
      trackProductEvent("PAGE_VIEW", pathname);
    }
  }, [pathname]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => reportBrowserError(event.message || "Browser error", pathname);
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : "Unhandled browser promise rejection";
      reportBrowserError(message, pathname);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [pathname]);

  return null;
}
