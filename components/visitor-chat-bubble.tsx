"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type VisitorChatMessage = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
};

export function VisitorChatBubble() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<VisitorChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const dismissedAutoOpen = useRef(false);
  const knownAdminMessages = useRef(0);

  useEffect(() => {
    const privateArea = ["/admin", "/dashboard"].some((path) => window.location.pathname.startsWith(path));
    if (privateArea) return;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => setEnabled(!data.authenticated))
      .catch(() => setEnabled(true));
  }, []);

  async function openSession() {
    const response = await fetch("/api/visitor-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "OPEN", pagePath: `${window.location.pathname}${window.location.search}` })
    });
    const data = await response.json() as { messages?: VisitorChatMessage[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Chat is unavailable.");
    const next = data.messages || [];
    setMessages(next);
    knownAdminMessages.current = next.filter((message) => !message.mine).length;
    setReady(true);
  }

  async function refresh() {
    const response = await fetch("/api/visitor-chat", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { messages?: VisitorChatMessage[] };
    const next = data.messages || [];
    const adminCount = next.filter((message) => !message.mine).length;
    if (adminCount > knownAdminMessages.current && !open) setUnread((count) => count + adminCount - knownAdminMessages.current);
    knownAdminMessages.current = adminCount;
    setMessages(next);
  }

  useEffect(() => {
    if (!enabled) { setOpen(false); return; }
    const start = window.setTimeout(() => {
      openSession()
        .then(() => {
          if (!dismissedAutoOpen.current) setOpen(true);
        })
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Chat is unavailable."));
    }, 2500);
    return () => window.clearTimeout(start);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready) return;
    const timer = window.setInterval(() => refresh().catch(() => undefined), 4_000);
    return () => window.clearInterval(timer);
  }, [enabled, ready, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true); setError("");
    const response = await fetch("/api/visitor-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "MESSAGE", body })
    });
    const data = await response.json() as { message?: VisitorChatMessage; error?: string };
    if (!response.ok || !data.message) setError(data.error || "Message could not be sent.");
    else {
      setMessages((current) => [...current, data.message!]);
      setBody("");
    }
    setBusy(false);
  }

  if (!enabled) return null;
  return <div className="visitor-chat-shell">
    {open && <section className="visitor-chat-panel" role="dialog" aria-label="Website visitor chat">
      <header><div><strong>Chat with us</strong><span><i/>Private website support</span></div><button type="button" onClick={() => { dismissedAutoOpen.current = true; setOpen(false); }} aria-label="Close visitor chat">×</button></header>
      <div className="visitor-chat-thread" aria-live="polite">
        {!messages.length && <div className="visitor-chat-welcome"><strong>Hello 👋</strong><p>Welcome to Crypto Sugar Babes. Ask us anything and an administrator can reply here.</p></div>}
        {messages.map((message) => <article className={message.mine ? "mine" : "admin"} key={message.id}><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></article>)}
      </div>
      {error && <p className="visitor-chat-error">{error}</p>}
      <form onSubmit={send}><textarea required maxLength={800} value={body} onChange={(event) => setBody(event.target.value)} placeholder={ready ? "Type your message…" : "Connecting…"} disabled={!ready || busy}/><button disabled={!ready || busy || !body.trim()} aria-label="Send visitor chat message">{busy ? "…" : "➤"}</button></form>
      <footer>Never share passwords, wallet keys, or recovery phrases.</footer>
    </section>}
    <button className="visitor-chat-launcher" type="button" onClick={() => { setOpen((current) => !current); setUnread(0); }} aria-label={open ? "Close website chat" : "Open website chat"}>
      {open ? "×" : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>}
      {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
    </button>
  </div>;
}
