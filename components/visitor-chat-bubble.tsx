"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type VisitorChatMessage = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
};

type VisitorChatResponse = {
  session?: { email?: string | null; authenticated?: boolean } | null;
  messages?: VisitorChatMessage[];
  error?: string;
};

export function VisitorChatBubble() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<VisitorChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const knownAdminMessages = useRef(0);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    setEnabled(true);
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  async function openSession() {
    const response = await fetch("/api/visitor-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "OPEN", pagePath: `${window.location.pathname}${window.location.search}` })
    });
    const data = await response.json() as VisitorChatResponse;
    if (!response.ok) throw new Error(data.error || "Chat is unavailable.");
    const next = data.messages || [];
    const visitorEmail = data.session?.email || "";
    setAuthenticated(Boolean(data.session?.authenticated));
    setEmail(visitorEmail);
    setSavedEmail(visitorEmail);
    setMessages(next);
    knownAdminMessages.current = next.filter((message) => !message.mine).length;
    setReady(true);
  }

  async function refresh() {
    const response = await fetch("/api/visitor-chat", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as VisitorChatResponse;
    const next = data.messages || [];
    if (data.session?.email) {
      setEmail(data.session.email);
      setSavedEmail(data.session.email);
    }
    setAuthenticated(Boolean(data.session?.authenticated));
    const adminCount = next.filter((message) => !message.mine).length;
    if (adminCount > knownAdminMessages.current && !open) setUnread((count) => count + adminCount - knownAdminMessages.current);
    knownAdminMessages.current = adminCount;
    setMessages(next);
  }

  useEffect(() => {
    if (!enabled) { setOpen(false); return; }
    const start = window.setTimeout(() => {
      openSession()
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

  async function saveEmail(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || emailBusy || email.trim().toLowerCase() === savedEmail) return;
    setEmailBusy(true); setError("");
    const response = await fetch("/api/visitor-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "EMAIL", email })
    });
    const data = await response.json() as { email?: string; error?: string };
    if (!response.ok || !data.email) setError(data.error || "Email address could not be saved.");
    else {
      setEmail(data.email);
      setSavedEmail(data.email);
    }
    setEmailBusy(false);
  }

  if (!enabled) return null;
  return <div className="visitor-chat-shell">
    {open && <section className="visitor-chat-panel" role="dialog" aria-modal="false" aria-label="Website pop-up chat">
      <header><div><strong>Chat with us</strong><span><i/>{authenticated ? "Signed-in member support" : "Private website support"}</span></div><button type="button" onClick={() => setOpen(false)} aria-label="Close pop-up chat">×</button></header>
      <form className="visitor-chat-contact-form" onSubmit={saveEmail}>
        <label htmlFor="visitor-chat-email">Email for follow-up <span>Optional</span></label>
        <div><input id="visitor-chat-email" type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={!ready || emailBusy}/><button disabled={!ready || emailBusy || !email.trim() || email.trim().toLowerCase() === savedEmail}>{emailBusy ? "Saving…" : email.trim().toLowerCase() === savedEmail && savedEmail ? "Saved" : "Save"}</button></div>
        <small>Shared only with the support administrator for this conversation.</small>
      </form>
      <div className="visitor-chat-thread" aria-live="polite">
        {!messages.length && <div className="visitor-chat-welcome"><strong>Hello 👋</strong><p>Welcome to Crypto Sugar Babes. Ask us anything and an administrator can reply here.</p></div>}
        {messages.map((message) => <article className={message.mine ? "mine" : "admin"} key={message.id}><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></article>)}
      </div>
      {error && <p className="visitor-chat-error">{error}</p>}
      <form className="visitor-chat-message-form" onSubmit={send}><textarea aria-label="Message to website support" required maxLength={800} value={body} onChange={(event) => setBody(event.target.value)} placeholder={ready ? "Type your message…" : "Connecting…"} disabled={!ready || busy}/><button disabled={!ready || busy || !body.trim()} aria-label="Send pop-up chat message">{busy ? "…" : "➤"}</button></form>
      <footer>Never share passwords, wallet keys, or recovery phrases.</footer>
    </section>}
    {!open && ready && !nudgeDismissed && unread === 0 && <button className="visitor-chat-nudge" type="button" onClick={() => { setNudgeDismissed(true); setOpen(true); }}>Chat with us. Not a bot.</button>}
    <button className="visitor-chat-launcher" type="button" onClick={() => { setNudgeDismissed(true); setOpen((current) => !current); setUnread(0); }} aria-label={open ? "Close website chat" : "Open website chat"}>
      {open ? "×" : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>}
      {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
    </button>
  </div>;
}
