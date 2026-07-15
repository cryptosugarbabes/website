"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { InstagramLink } from "@/components/instagram-link";

type Tab = "overview" | "messages" | "profile" | "activity" | "safety" | "settings";
type Identity = {
  email: string | null; walletAddress: string | null; walletChain: string | null;
  status: string; suspensionReason?: string | null; deletionRequestedAt?: string | null; createdAt: string;
};
type CreatorProfile = {
  id: string; name: string; age: number; city: string; country: string; headline: string; bio: string;
  interests: string[]; reviewStatus: string; rejectionReason?: string | null; messagesSent: number;
  messagesReceived: number; photoLikes: number; discoveryRank: number | null; creatorCount: number | null;
  totalPoints: number; points24h: number;
  photos: Array<{ id: string; url: string; approved: boolean; paidLikes: number }>;
};
type DashboardData = {
  identity: Identity;
  account: { type: "CREATOR" | "CUSTOMER" | null; displayName?: string | null; bio?: string | null; generosityPoints: number };
  creatorProfile: CreatorProfile | null;
  stats: { conversations: number; unread: number; favorites: number; messagesSent: number; supportSentUsdc: number; creatorEarningsUsdc: number; platformFeesUsdc: number };
  favorites: Array<{ id: string; name: string; city: string; country: string; headline: string; imageUrl?: string | null }>;
  activity: Array<{ id: string; direction: string; kind: string; grossUsdc: number; creatorShareUsdc: number; platformShareUsdc: number; profileName: string; network: string; createdAt: string; transactionHashes: string[] }>;
  reports: Array<{ id: string; category: string; status: string; createdAt: string }>;
};
type Conversation = {
  id: string; counterpartName: string; imageUrl?: string | null; blockedByMe: boolean; blockedMe: boolean;
  priorityBoostUsdc: number; updatedAt: string;
  messages: Array<{ id: string; body: string; mine: boolean; status: string; boostAmountUsdc: number; createdAt: string }>;
};

function money(value: number) { return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC`; }
function short(value?: string | null) { return value ? `${value.slice(0, 7)}…${value.slice(-5)}` : "Not connected"; }
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function MemberDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [reply, setReply] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerBio, setCustomerBio] = useState("");
  const [profileForm, setProfileForm] = useState({ name: "", age: "", city: "", country: "", headline: "", bio: "", interests: "" });
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeConversationId) || conversations[0] || null, [conversations, activeConversationId]);

  async function loadDashboard() {
    setLoading(true); setError("");
    const response = await fetch("/api/dashboard/member", { cache: "no-store" });
    if (response.status === 401) { setSignedOut(true); setData(null); setLoading(false); return; }
    const next = await response.json() as DashboardData & { error?: string };
    if (!response.ok) { setError(next.error || "Dashboard unavailable."); setLoading(false); return; }
    setData(next); setSignedOut(false);
    setCustomerName(next.account.displayName || ""); setCustomerBio(next.account.bio || "");
    if (next.creatorProfile) setProfileForm({
      name: next.creatorProfile.name, age: String(next.creatorProfile.age), city: next.creatorProfile.city,
      country: next.creatorProfile.country, headline: next.creatorProfile.headline, bio: next.creatorProfile.bio,
      interests: next.creatorProfile.interests.join(", ")
    });
    setLoading(false);
  }

  async function loadMessages() {
    const response = await fetch("/api/messages", { cache: "no-store" });
    const next = await response.json() as { conversations?: Conversation[]; error?: string };
    if (!response.ok) throw new Error(next.error || "Messages unavailable.");
    setConversations(next.conversations || []);
    if (!activeConversationId && next.conversations?.[0]) setActiveConversationId(next.conversations[0].id);
  }

  useEffect(() => { loadDashboard().catch(() => setError("Dashboard unavailable.")); }, []);
  useEffect(() => { if (data?.account.type) loadMessages().catch(() => undefined); }, [data?.account.type]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 4500); return () => window.clearTimeout(timer); }, [notice]);

  async function requestCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/auth/email/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const next = await response.json() as { challengeId?: string; error?: string };
    if (!response.ok || !next.challengeId) setError(next.error || "Could not send a code.");
    else { setChallengeId(next.challengeId); setNotice("Check your email for the six-digit code."); }
    setBusy(false);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/auth/email/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code, challengeId }) });
    const next = await response.json() as { authenticated?: boolean; error?: string };
    if (!response.ok || !next.authenticated) setError(next.error || "That code could not be verified.");
    else await loadDashboard();
    setBusy(false);
  }

  async function chooseCustomer(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "CUSTOMER", displayName: customerName, bio: customerBio }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Could not save your account."); else { setNotice("Your private customer account is ready."); await loadDashboard(); }
    setBusy(false);
  }

  async function saveCustomer(event: FormEvent) { await chooseCustomer(event); }

  async function saveCreator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = event.currentTarget;
    const response = await fetch("/api/profiles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...profileForm, age: Number(profileForm.age), interests: profileForm.interests.split(",").map((item) => item.trim()).filter(Boolean)
    }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) { setError(next.error || "Could not save your profile."); setBusy(false); return; }
    const photoInput = form.elements.namedItem("photos") as HTMLInputElement | null;
    const files = Array.from(photoInput?.files || []);
    let uploadFailed = false;
    for (const file of files) {
      const upload = new FormData(); upload.append("photo", file);
      const uploaded = await fetch("/api/profile/photos", { method: "POST", body: upload });
      if (!uploaded.ok) { const issue = await uploaded.json() as { error?: string }; setError(issue.error || "One photo could not be uploaded."); uploadFailed = true; break; }
    }
    if (!uploadFailed) setNotice("Your creator profile was submitted for administrator review.");
    await loadDashboard(); setBusy(false);
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault(); if (!activeConversation || !reply.trim()) return;
    setBusy(true); setError("");
    const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: activeConversation.id, body: reply }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Reply not sent."); else { setReply(""); await loadMessages(); await loadDashboard(); }
    setBusy(false);
  }

  async function removePhoto(photoId: string) {
    if (!window.confirm("Remove this photo? Your profile will return to the review queue.")) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/profile/photos/${photoId}`, { method: "DELETE" });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Photo not removed.");
    else { setNotice("Photo removed. Your profile is awaiting review."); await loadDashboard(); }
    setBusy(false);
  }

  async function deletion(action: "REQUEST_DELETION" | "CANCEL_DELETION") {
    if (action === "REQUEST_DELETION" && deletionConfirmation !== "DELETE") { setError("Type DELETE to confirm your request."); return; }
    setBusy(true); setError("");
    const response = await fetch("/api/dashboard/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, confirmation: deletionConfirmation }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Account request failed."); else { setNotice(action === "REQUEST_DELETION" ? "Your deletion request was sent to the administrator." : "Your deletion request was cancelled."); setDeletionConfirmation(""); await loadDashboard(); }
    setBusy(false);
  }

  async function signOut() { await fetch("/api/auth/logout", { method: "POST" }); setData(null); setSignedOut(true); }

  if (loading) return <main className="member-shell member-loading"><div className="dashboard-spinner"/><p>Opening your private dashboard…</p></main>;
  if (signedOut || !data) return <main className="member-shell"><header className="member-public-header"><a href="/" className="member-brand"><img src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a><a href="/">Return home</a></header><section className="member-signin"><span>PRIVATE MEMBER ACCESS</span><h1>Your world, in one place.</h1><p>Sign in with your email to open messages, favorites, profile controls and activity.</p>{challengeId ? <form onSubmit={verifyCode}><label>Six-digit code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000"/></label><button disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify & open dashboard"}</button><button className="member-subtle-button" type="button" onClick={() => setChallengeId("")}>Use another email</button></form> : <form onSubmit={requestCode}><label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label><button disabled={busy}>{busy ? "Sending…" : "Email me a sign-in code"}</button></form>}{error && <div className="dashboard-error">{error}</div>}</section></main>;

  const creator = data.account.type === "CREATOR";
  const roleLabel = creator ? "Sugar Babe" : data.account.type === "CUSTOMER" ? "Sugar Daddy" : "New member";
  return <main className="member-shell">
    <header className="member-topbar"><div className="brand-social"><a className="member-brand" href="/"><img src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a><InstagramLink/></div><div><a href="/">Discover</a><button onClick={signOut}>Sign out</button></div></header>
    <div className="member-dashboard-grid">
      <aside className="member-sidebar"><div className="member-identity"><span>{roleLabel}</span><strong>{data.account.displayName || data.creatorProfile?.name || data.identity.email || short(data.identity.walletAddress)}</strong><small>{data.identity.status}</small></div><nav>{(["overview", "messages", "profile", "activity", "safety", "settings"] as Tab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item === "activity" ? "Payments & activity" : label(item)}{item === "messages" && data.stats.unread > 0 ? <em>{data.stats.unread}</em> : null}</button>)}</nav></aside>
      <section className="member-content">
        {data.identity.status === "SUSPENDED" && <div className="dashboard-warning"><strong>Account suspended</strong><p>{data.identity.suspensionReason || "Contact safety support for more information."}</p></div>}
        {error && <div className="dashboard-error">{error}</div>}{notice && <div className="dashboard-notice">{notice}</div>}
        {!data.account.type ? <section className="dashboard-panel onboarding-panel"><span className="dashboard-kicker">WELCOME</span><h1>Choose how you will use Crypto Sugar.</h1><div className="onboarding-grid"><article><h2>Sugar Babe</h2><p>Creators publish a reviewed profile and receive messages, likes, gifts and boosts.</p>{data.identity.walletAddress ? <button onClick={async () => { setBusy(true); const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "CREATOR" }) }); if (response.ok) await loadDashboard(); else setError((await response.json()).error); setBusy(false); }}>Continue as creator</button> : <a href="/">Connect a wallet on the homepage</a>}</article><article><h2>Sugar Daddy</h2><p>Customers stay private, message freely, and connect a wallet only for paid support.</p><form onSubmit={chooseCustomer}><input required maxLength={80} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Private display name"/><textarea maxLength={300} value={customerBio} onChange={(event) => setCustomerBio(event.target.value)} placeholder="Private introduction (optional)"/><button disabled={busy}>Continue as customer</button></form></article></div></section> : <>
          {tab === "overview" && <section><div className="dashboard-heading"><span className="dashboard-kicker">PRIVATE OVERVIEW</span><h1>Welcome back, {data.account.displayName || data.creatorProfile?.name || "member"}.</h1><p>{creator ? "Manage your presence, conversations and creator activity." : "Your conversations, favorites and generosity—all kept private."}</p></div><div className="metric-grid"><article><span>Conversations</span><strong>{data.stats.conversations}</strong><small>{data.stats.unread} unread</small></article><article><span>{creator ? "Creator earnings" : "Support sent"}</span><strong>{money(creator ? data.stats.creatorEarningsUsdc : data.stats.supportSentUsdc)}</strong><small>{creator ? "Your confirmed 90% share" : "Confirmed on-chain"}</small></article><article><span>{creator ? "Paid likes" : "Favorites"}</span><strong>{creator ? data.creatorProfile?.photoLikes || 0 : data.stats.favorites}</strong><small>{creator ? `${data.creatorProfile?.totalPoints || 0} creator points` : `${data.account.generosityPoints} generosity points`}</small></article><article><span>{creator ? "Discovery" : "Messages sent"}</span><strong>{creator && data.creatorProfile?.discoveryRank ? `#${data.creatorProfile.discoveryRank}` : data.stats.messagesSent}</strong><small>{creator && data.creatorProfile?.creatorCount ? `of ${data.creatorProfile.creatorCount} approved creators` : "Free private messages"}</small></article></div>{creator && data.creatorProfile && <div className="dashboard-panel creator-position"><div><span>24-HOUR DISCOVERY SIGNAL</span><strong>{data.creatorProfile.points24h} points today</strong><p>Recent likes, gifts and boosts influence discovery ordering for the current 24-hour period.</p></div><div className={`review-pill ${data.creatorProfile.reviewStatus.toLowerCase()}`}>{label(data.creatorProfile.reviewStatus)}</div></div>}{!creator && <div className="dashboard-panel"><div className="dashboard-panel-title"><h2>Saved creators</h2><button onClick={() => setTab("profile")}>View all</button></div><div className="favorite-dashboard-grid">{data.favorites.slice(0, 4).map((item) => <a href={`/?profile=${item.id}`} key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.name[0]}</span>}<strong>{item.name}</strong><small>{item.city}, {item.country}</small></a>)}{!data.favorites.length && <p className="dashboard-empty">Profiles you save will appear here.</p>}</div></div>}</section>}
          {tab === "messages" && <section><div className="dashboard-heading"><span className="dashboard-kicker">PRIVATE MESSAGES</span><h1>Inbox</h1><p>Messages are free. Boosts remain optional and require a connected wallet.</p></div><div className="dashboard-inbox"><aside>{conversations.map((conversation) => <button className={conversation.id === activeConversation?.id ? "active" : ""} key={conversation.id} onClick={() => setActiveConversationId(conversation.id)}>{conversation.imageUrl ? <img src={conversation.imageUrl} alt=""/> : <span>{conversation.counterpartName[0]}</span>}<div><strong>{conversation.counterpartName}{conversation.priorityBoostUsdc > 0 ? <em>BOOST</em> : null}</strong><small>{conversation.messages.at(-1)?.body || "New conversation"}</small></div></button>)}{!conversations.length && <p className="dashboard-empty">No conversations yet.</p>}</aside><div className="dashboard-thread">{activeConversation ? <><header><strong>{activeConversation.counterpartName}</strong><small>{activeConversation.blockedByMe || activeConversation.blockedMe ? "Messaging blocked" : "Private conversation"}</small></header><div>{activeConversation.messages.map((message) => <article className={message.mine ? "mine" : ""} key={message.id}>{message.boostAmountUsdc > 0 && <span>BOOSTED · {money(message.boostAmountUsdc)}</span>}<p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString()}</small></article>)}</div>{activeConversation.blockedByMe || activeConversation.blockedMe ? <p className="dashboard-empty">Messaging is disabled for this conversation.</p> : <form onSubmit={sendReply}><textarea required maxLength={800} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply…"/><button disabled={busy}>Send free message</button></form>}</> : <div className="dashboard-empty">Choose a conversation.</div>}</div></div></section>}
          {tab === "profile" && <section><div className="dashboard-heading"><span className="dashboard-kicker">{creator ? "CREATOR PROFILE" : "PRIVATE PROFILE"}</span><h1>{creator ? "Your public presence" : "Your private account"}</h1><p>{creator ? "Profile changes and new photos return to the administrator review queue." : "Only creators you message can see your display name and private introduction."}</p></div>{creator ? <form className="dashboard-panel dashboard-form" onSubmit={saveCreator}><div className="form-grid"><label>Display name<input required maxLength={80} value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}/></label><label>Age<input required type="number" min={18} max={99} value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}/></label><label>City<input required maxLength={100} value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}/></label><label>Country<input required maxLength={100} value={profileForm.country} onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}/></label></div><label>Headline<input required maxLength={90} value={profileForm.headline} onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })}/></label><label>About<textarea required maxLength={500} value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}/></label><label>Interests · comma separated<input value={profileForm.interests} onChange={(e) => setProfileForm({ ...profileForm, interests: e.target.value })}/></label><label>Add photos<input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp"/></label>{data.creatorProfile?.photos.length ? <div className="dashboard-photo-grid">{data.creatorProfile.photos.map((photo) => <div key={photo.id}><img src={photo.url} alt=""/><small>{photo.approved ? "Approved" : "Reviewing"} · {photo.paidLikes} likes</small></div>)}</div> : null}<button disabled={busy}>{busy ? "Saving…" : "Save & submit for review"}</button>{data.creatorProfile?.rejectionReason && <div className="dashboard-warning"><strong>Previous review note</strong><p>{data.creatorProfile.rejectionReason}</p></div>}</form> : <><form className="dashboard-panel dashboard-form" onSubmit={saveCustomer}><label>Private display name<input required maxLength={80} value={customerName} onChange={(event) => setCustomerName(event.target.value)}/></label><label>Private introduction<textarea maxLength={300} value={customerBio} onChange={(event) => setCustomerBio(event.target.value)}/></label><button disabled={busy}>Save private profile</button></form><div className="dashboard-panel"><div className="dashboard-panel-title"><h2>Favorites</h2><span>{data.favorites.length}</span></div><div className="favorite-dashboard-grid">{data.favorites.map((item) => <a href={`/?profile=${item.id}`} key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.name[0]}</span>}<strong>{item.name}</strong><small>{item.city}, {item.country}</small></a>)}{!data.favorites.length && <p className="dashboard-empty">No saved creators yet.</p>}</div></div></>}</section>}
          {tab === "activity" && <section><div className="dashboard-heading"><span className="dashboard-kicker">ON-CHAIN LEDGER</span><h1>Payments & activity</h1><p>Confirmed likes, gifts and boosts with their creator/platform split.</p></div><div className="dashboard-panel activity-table"><div className="table-row table-head"><span>Activity</span><span>Network</span><span>Gross</span><span>{creator ? "Your share" : "Creator share"}</span><span>Date</span></div>{data.activity.map((item) => <div className="table-row" key={item.id}><span><strong>{label(item.kind)}</strong><small>{item.direction === "SENT" ? `To ${item.profileName}` : `From a supporter`}</small></span><span>{item.network}</span><span>{money(item.grossUsdc)}</span><span>{money(item.creatorShareUsdc)}</span><span>{new Date(item.createdAt).toLocaleDateString()}</span>{item.transactionHashes.length ? <small className="transaction-line">{item.transactionHashes.map((hash) => short(hash)).join(" · ")}</small> : null}</div>)}{!data.activity.length && <p className="dashboard-empty">No confirmed payment activity yet.</p>}</div></section>}
          {tab === "safety" && <section><div className="dashboard-heading"><span className="dashboard-kicker">SAFETY CENTER</span><h1>Your safety controls</h1><p>Track reports and use the inbox to block or report a conversation.</p></div><div className="dashboard-panel"><div className="dashboard-panel-title"><h2>Submitted reports</h2><a href="mailto:email@cryptosugarbabes.com?subject=Safety%20report">Contact safety</a></div>{data.reports.map((report) => <div className="safety-report-row" key={report.id}><strong>{label(report.category)}</strong><span className={`review-pill ${report.status.toLowerCase()}`}>{label(report.status)}</span><small>{new Date(report.createdAt).toLocaleString()}</small></div>)}{!data.reports.length && <p className="dashboard-empty">You have not submitted any reports.</p>}</div><div className="dashboard-panel safety-links"><a href="/safety">Safety policy</a><a href="/disputes">Disputes</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div></section>}
          {tab === "settings" && <section><div className="dashboard-heading"><span className="dashboard-kicker">ACCOUNT & PRIVACY</span><h1>Settings</h1><p>Review the identifiers connected to your account and manage your data request.</p></div><div className="dashboard-panel identity-list"><div><span>Email</span><strong>{data.identity.email || "Not connected"}</strong></div><div><span>Wallet</span><strong>{short(data.identity.walletAddress)}</strong><small>{data.identity.walletChain ? label(data.identity.walletChain) : "Connect only when needed"}</small></div><div><span>Member since</span><strong>{new Date(data.identity.createdAt).toLocaleDateString()}</strong></div><div><span>Account status</span><strong>{label(data.identity.status)}</strong></div></div><div className="dashboard-panel deletion-panel"><h2>Account deletion</h2>{data.identity.deletionRequestedAt ? <><p>Your request was submitted on {new Date(data.identity.deletionRequestedAt).toLocaleDateString()}. An administrator will review required safety, dispute and transaction-retention obligations before deletion or anonymisation.</p><button disabled={busy} onClick={() => deletion("CANCEL_DELETION")}>Cancel deletion request</button></> : <><p>This sends a formal deletion request. Confirmed blockchain records cannot be erased from the network, but we can remove or anonymise eligible platform data.</p><label>Type DELETE to confirm<input value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)}/></label><button className="danger-button" disabled={busy || deletionConfirmation !== "DELETE"} onClick={() => deletion("REQUEST_DELETION")}>Request account deletion</button></>}</div></section>}
        </>}
      </section>
    </div>
  </main>;
}
