export type ClientProductEvent = "PAGE_VIEW" | "SIGN_IN_OPENED" | "PROFILE_VIEWED";

function send(body: Record<string, string>) {
  void fetch("/api/observability", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true
  }).catch(() => undefined);
}

export function trackProductEvent(event: ClientProductEvent, pagePath = window.location.pathname) {
  send({ event, pagePath });
}

export function reportBrowserError(message: string, pagePath = window.location.pathname) {
  send({ error: message.slice(0, 500), pagePath });
}
