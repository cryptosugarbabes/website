"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { BaseSettlementSetup } from "@/components/base-settlement-setup";

type AdminTab = "overview" | "profiles" | "accounts" | "conversations" | "forums" | "notifications" | "payments" | "reports" | "audit";
type ReviewProfile = { id: string; name: string; age: number; region: string; country: string; headline: string; bio: string; interests: string[]; status: string; reviewed: boolean; rejectionReason?: string; photos: Array<{ id: string; url: string; approved: boolean; reviewed: boolean }> };
type SafetyReport = { id: string; category: string; details: string; status: string; adminNote?: string | null; createdAt: string; reporterWallet?: string | null; reportedWallet?: string | null; profileName?: string | null; messageBody?: string | null };
type Metrics = { accounts: number; creators: number; customers: number; pendingProfiles: number; openReports: number; confirmedPayments: number; grossUsdc: number; creatorUsdc: number; platformUsdc: number; deletionRequests: number };
type Account = { id: string; email?: string | null; walletAddress?: string | null; walletChain?: string | null; type?: string | null; status: string; suspensionReason?: string | null; deletionRequestedAt?: string | null; createdAt: string; displayName?: string | null; profileStatus?: string | null; acceptanceComplete: boolean; adultAttestedAt?: string | null; termsAcceptedAt?: string | null; privacyAcceptedAt?: string | null; conversations: number; messages: number; supportSentUsdc: number; creatorEarnedUsdc: number };
type Payment = { id: string; kind: string; network: string; grossUsdc: number; creatorShareUsdc: number; platformShareUsdc: number; createdAt: string; profileName: string; supporter: string; transactionHashes: string[] };
type Audit = { id: string; action: string; note?: string | null; createdAt: string; displayName?: string | null; email?: string | null; actorEmail?: string | null };
type AdminConversation = { id: string; creatorName: string; creatorEmail?: string | null; creatorWallet?: string | null; customerName: string; customerEmail?: string | null; customerWallet?: string | null; messageCount: number; reportCount: number; updatedAt: string };
type Transcript = { conversation: { id: string; creator: { name: string; email?: string | null }; customer: { name: string; email?: string | null }; accessReason: string; accessedBy: string }; messages: Array<{ id: string; senderRole: string; senderName: string; body: string; status: string; boostAmountUsdc: number; createdAt: string }> };
type AlertAccount = { userId: string; name: string; email?: string | null; walletAddress?: string | null; walletChain?: string | null; accountType?: string | null; enabled: boolean };
type ForumPostModeration = { id: string; topicId: string; body: string; status: string; authorName: string; authorEmail?: string | null; createdAt: string };
type ForumTopicModeration = { id: string; categoryName: string; title: string; body: string; status: string; pinned: boolean; authorName: string; authorEmail?: string | null; replyCount: number; hiddenReplyCount: number; createdAt: string; lastActivityAt: string; posts: ForumPostModeration[] };
type ForumModerationAudit = { id: string; topicId?: string | null; postId?: string | null; action: string; reason?: string | null; actorEmail: string; createdAt: string; topicTitle?: string | null };
type ForumModerationAction = "PIN_TOPIC" | "UNPIN_TOPIC" | "LOCK_TOPIC" | "UNLOCK_TOPIC" | "HIDE_TOPIC" | "RESTORE_TOPIC" | "HIDE_POST" | "RESTORE_POST";

const emptyMetrics: Metrics = { accounts: 0, creators: 0, customers: 0, pendingProfiles: 0, openReports: 0, confirmedPayments: 0, grossUsdc: 0, creatorUsdc: 0, platformUsdc: 0, deletionRequests: 0 };
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function money(value: number) { return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC`; }
function short(value?: string | null) { return value ? `${value.slice(0, 7)}…${value.slice(-5)}` : "—"; }
function explorerUrl(network: string, hash: string) { return network === "SOLANA" ? `https://solscan.io/tx/${hash}` : `https://basescan.org/tx/${hash}`; }

export function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [profiles, setProfiles] = useState<ReviewProfile[]>([]);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [alertAccounts, setAlertAccounts] = useState<AlertAccount[]>([]);
  const [forumTopics, setForumTopics] = useState<ForumTopicModeration[]>([]);
  const [forumAudit, setForumAudit] = useState<ForumModerationAudit[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function loadProfiles() {
    const response = await fetch("/api/admin/profiles", { cache: "no-store" });
    if (response.status === 401) { setSignedIn(false); return false; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load profiles.");
    setProfiles(data.profiles || []); setSignedIn(true); return true;
  }
  async function loadReports() {
    const response = await fetch("/api/admin/reports", { cache: "no-store" });
    if (response.status === 401) { setSignedIn(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load safety reports.");
    setReports(data.reports || []);
  }
  async function loadOperations() {
    const response = await fetch("/api/admin/operations", { cache: "no-store" });
    if (response.status === 401) { setSignedIn(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load operations.");
    setMetrics(data.metrics || emptyMetrics); setAccounts(data.accounts || []); setPayments(data.payments || []); setAudit(data.audit || []);
  }
  async function loadConversations(searchValue = "") {
    const response = await fetch(`/api/admin/conversations?search=${encodeURIComponent(searchValue)}`, { cache: "no-store" });
    if (response.status === 401) { setSignedIn(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load conversations.");
    setConversations(data.conversations || []);
  }
  async function loadMessageAlerts() {
    const response = await fetch("/api/admin/message-alerts", { cache: "no-store" });
    if (response.status === 401) { setSignedIn(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load message alerts.");
    setAlertAccounts(data.accounts || []);
  }
  async function loadForums() {
    const response = await fetch("/api/admin/forums", { cache: "no-store" });
    if (response.status === 401) { setSignedIn(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load forum moderation.");
    setForumTopics(data.topics || []); setForumAudit(data.audit || []);
  }
  async function loadDashboard() { const active = await loadProfiles(); if (active) await Promise.all([loadReports(), loadOperations(), loadConversations(), loadMessageAlerts(), loadForums()]); }
  useEffect(() => { loadDashboard().catch((caught) => setError(caught.message)); }, []);

  async function login(event: FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Sign-in failed."); return; }
    setPassword(""); await loadDashboard();
  }
  async function updateReport(id: string, status: "REVIEWING" | "RESOLVED" | "DISMISSED") {
    const note = window.prompt("Private administrator note (optional):")?.trim() || "";
    setBusy(id); setError("");
    const response = await fetch("/api/admin/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status, note }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Report update failed."); else await Promise.all([loadReports(), loadOperations()]);
    setBusy("");
  }
  async function review(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Reason shown to the creator:")?.trim() : "";
    if (action === "reject" && !reason) return;
    setBusy(id); setError("");
    const response = await fetch(`/api/admin/profiles/${id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Review failed."); else await Promise.all([loadProfiles(), loadOperations()]);
    setBusy("");
  }
  async function reviewPhoto(photoId: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Reason shown to the creator for this photo:")?.trim() : "";
    if (action === "reject" && !reason) return;
    setBusy(photoId); setError("");
    const response = await fetch(`/api/admin/media/${photoId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Photo review failed."); else await Promise.all([loadProfiles(), loadOperations()]);
    setBusy("");
  }
  async function accountAction(account: Account, action: "SUSPEND" | "RESTORE" | "CLEAR_DELETION_REQUEST") {
    let note = "";
    if (action === "SUSPEND") { note = window.prompt(`Why are you suspending ${account.displayName || account.email || "this account"}?`)?.trim() || ""; if (!note) return; }
    if (action === "RESTORE" && !window.confirm("Restore this account to active access?")) return;
    if (action === "CLEAR_DELETION_REQUEST" && !window.confirm("Mark this deletion request as administratively reviewed? Only do this after completing the required retention/deletion process.")) return;
    setBusy(account.id); setError("");
    const response = await fetch("/api/admin/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: account.id, action, note }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Account update failed."); else await loadOperations();
    setBusy("");
  }

  async function openTranscript(conversation: AdminConversation) {
    const reason = window.prompt("Why do you need to view this private conversation? This reason and your administrator identity will be recorded.")?.trim() || "";
    if (reason.length < 5) return;
    setBusy(conversation.id); setError(""); setTranscript(null);
    const response = await fetch(`/api/admin/conversations/${conversation.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Transcript access failed."); else setTranscript(data);
    setBusy("");
  }

  async function toggleMessageAlert(account: AlertAccount) {
    setBusy(account.userId); setError("");
    const response = await fetch("/api/admin/message-alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: account.userId, enabled: !account.enabled }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Message alert settings could not be saved.");
    else await loadMessageAlerts();
    setBusy("");
  }

  async function moderateForum(action: ForumModerationAction, targetId: string) {
    const needsReason = action === "HIDE_TOPIC" || action === "HIDE_POST";
    const reason = needsReason ? window.prompt("Private reason for hiding this forum content:")?.trim() || "" : "";
    if (needsReason && reason.length < 3) return;
    setBusy(targetId); setError("");
    const response = await fetch("/api/admin/forums", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, targetId, reason }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Forum moderation could not be saved.");
    else await loadForums();
    setBusy("");
  }

  const filteredAccounts = useMemo(() => { const needle = search.trim().toLowerCase(); return accounts.filter((item) => !needle || [item.displayName, item.email, item.walletAddress, item.type, item.status].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [accounts, search]);
  const memberEmailCount = accounts.filter((account) => Boolean(account.email)).length;
  const pending = profiles.filter((profile) => !profile.reviewed || profile.photos.some((photo) => !photo.reviewed));
  const activeReports = reports.filter((report) => ["OPEN", "REVIEWING"].includes(report.status));

  if (!signedIn) return <main className="admin-shell"><section className="admin-login"><span>CRYPTO SUGAR BABES</span><h1>Operations access</h1><p>Sign in on the main site with an approved administrator email, then return here. You can also use the private administrator password.</p><div className="review-actions"><a href="/">Sign in with administrator email</a></div><form onSubmit={login}><input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Administrator password"/><button type="submit">Admin sign in</button></form>{error && <div className="form-error">{error}</div>}</section></main>;

  return <main className="admin-shell admin-console">
    <header className="admin-header"><div><span>CRYPTO SUGAR BABES</span><h1>Operations console</h1></div><div><a href="/">View site</a><button onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); setSignedIn(false); }}>Sign out</button></div></header>
    <div className="admin-console-grid"><aside><nav>{(["overview", "profiles", "accounts", "conversations", "forums", "notifications", "payments", "reports", "audit"] as AdminTab[]).map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{label(item)}{item === "profiles" && pending.length ? <em>{pending.length}</em> : null}{item === "reports" && activeReports.length ? <em>{activeReports.length}</em> : null}</button>)}</nav></aside><section className="admin-console-content">{error && <div className="form-error">{error}</div>}
      {tab === "overview" && <><div className="admin-page-heading"><span>LIVE OPERATIONS</span><h2>Platform overview</h2><p>Membership, moderation and confirmed settlement at a glance.</p></div><div className="admin-metric-grid"><article><span>Accounts</span><strong>{metrics.accounts}</strong><small>{metrics.creators} creators · {metrics.customers} customers</small></article><article><span>Needs review</span><strong>{pending.length}</strong><small>{metrics.openReports} open safety reports</small></article><article><span>Confirmed volume</span><strong>{money(metrics.grossUsdc)}</strong><small>{metrics.confirmedPayments} payments</small></article><article><span>Platform revenue</span><strong>{money(metrics.platformUsdc)}</strong><small>{money(metrics.creatorUsdc)} to creators</small></article></div>{metrics.deletionRequests > 0 && <button className="admin-alert-card" onClick={() => setTab("accounts")}><strong>{metrics.deletionRequests} deletion request{metrics.deletionRequests === 1 ? "" : "s"}</strong><span>Review account and retention obligations →</span></button>}<div className="admin-overview-columns"><article><div className="admin-section-heading"><h3>Live profiles needing review</h3><button onClick={() => setTab("profiles")}>Open profiles</button></div>{pending.slice(0, 5).map((profile) => <div className="admin-compact-row" key={profile.id}><strong>{profile.name}</strong><span>{profile.country} · {profile.region}</span><em>{profile.photos.length} photos</em></div>)}{!pending.length && <p className="admin-empty">Everything reviewed.</p>}</article><article><div className="admin-section-heading"><h3>Active safety cases</h3><button onClick={() => setTab("reports")}>Open reports</button></div>{activeReports.slice(0, 5).map((report) => <div className="admin-compact-row" key={report.id}><strong>{label(report.category)}</strong><span>{report.profileName || "Account report"}</span><em>{label(report.status)}</em></div>)}{!activeReports.length && <p className="admin-empty">No active cases.</p>}</article></div></>}
      {tab === "profiles" && <><div className="admin-page-heading"><span>CONTENT REVIEW</span><h2>Creator profiles</h2><p>Profiles and photos publish automatically. Review them here at any time; rejecting content removes it from public discovery.</p></div><section className="review-list">{profiles.length === 0 ? <p className="admin-empty">No profiles submitted.</p> : profiles.map((profile) => { const photosReady = profile.photos.length > 0 && profile.photos.every((photo) => photo.approved); return <article className="review-card" key={profile.id}><div className="review-photos">{profile.photos.length ? profile.photos.map((photo, index) => <div className="review-photo" key={photo.id}><img src={photo.url} alt={`${profile.name} photo ${index + 1}`}/><span className={photo.approved ? "approved" : "pending"}>{photo.approved ? (photo.reviewed ? "Reviewed · published" : "Live · needs review") : "Hidden"}</span><div><button disabled={busy === photo.id || (photo.approved && photo.reviewed)} onClick={() => reviewPhoto(photo.id, "approve")}>{photo.approved ? "Mark reviewed" : "Restore"}</button><button className="reject" disabled={busy === photo.id} onClick={() => reviewPhoto(photo.id, "reject")}>Reject</button></div></div>) : <div>No photos</div>}</div><div className="review-copy"><span className={`review-status status-${profile.status.toLowerCase()}`}>{profile.status === "APPROVED" ? (profile.reviewed ? "Published · reviewed" : "Live · needs review") : label(profile.status)}</span><h2>{profile.name}, {profile.age}</h2><p className="location">{profile.country} · {profile.region}</p><h3>{profile.headline}</h3><p>{profile.bio}</p><div className="tag-row">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>{profile.rejectionReason && <p className="rejection-note">Previous reason: {profile.rejectionReason}</p>}{!photosReady && <p className="review-guidance">Restore every hidden photo before restoring this profile to public discovery.</p>}<div className="review-actions"><button disabled={busy === profile.id || !photosReady || profile.reviewed} onClick={() => review(profile.id, "approve")}>{profile.status === "APPROVED" ? "Mark profile reviewed" : "Restore profile"}</button><button className="reject" disabled={busy === profile.id} onClick={() => review(profile.id, "reject")}>Remove with reason</button></div></div></article>; })}</section></>}
      {tab === "accounts" && <><div className="admin-page-heading"><span>MEMBER OPERATIONS</span><h2>Accounts</h2><p>Search identities, review activity, manage suspensions and process deletion requests.</p></div><div className="admin-account-tools"><input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, wallet, role or status"/><a className="admin-export-button" href="/api/admin/members/export">Download member emails (.csv)</a></div><p className="admin-member-summary">{accounts.length} members · {memberEmailCount} verified email addresses</p><div className="admin-account-list">{filteredAccounts.map((account) => <article className={account.status === "SUSPENDED" ? "suspended" : ""} key={account.id}><header><div><strong>{account.displayName || "Unnamed member"}</strong><span>{account.type ? label(account.type) : "Role not chosen"}</span></div><em className={`review-status status-${account.status.toLowerCase()}`}>{label(account.status)}</em></header><div className="admin-account-identifiers"><span>{account.email || "No email"}</span><span>{account.walletChain ? `${label(account.walletChain)} · ${short(account.walletAddress)}` : "No wallet"}</span><span>Joined {new Date(account.createdAt).toLocaleDateString()}</span></div><div className="admin-account-stats"><span><strong>{account.conversations}</strong> conversations</span><span><strong>{account.messages}</strong> messages</span><span><strong>{money(account.supportSentUsdc)}</strong> sent</span><span><strong>{money(account.creatorEarnedUsdc)}</strong> earned</span></div>{account.profileStatus && <p>Creator profile: <strong>{label(account.profileStatus)}</strong></p>}{account.suspensionReason && <p className="rejection-note">Suspension: {account.suspensionReason}</p>}{account.deletionRequestedAt && <div className="deletion-request"><strong>Deletion requested {new Date(account.deletionRequestedAt).toLocaleDateString()}</strong><p>Complete required retention, dispute and anonymisation checks before clearing this request.</p><button disabled={busy === account.id} onClick={() => accountAction(account, "CLEAR_DELETION_REQUEST")}>Mark administratively reviewed</button></div>}<div className="review-actions">{account.status === "ACTIVE" ? <button className="reject" disabled={busy === account.id} onClick={() => accountAction(account, "SUSPEND")}>Suspend account</button> : <button disabled={busy === account.id} onClick={() => accountAction(account, "RESTORE")}>Restore account</button>}</div></article>)}</div></>}
      {tab === "conversations" && <><div className="admin-page-heading"><span>AUDITED MESSAGE ACCESS</span><h2>Conversations</h2><p>Search conversation metadata first. Opening message content requires a reason and creates a permanent access record.</p></div><form className="admin-account-tools" onSubmit={(event) => { event.preventDefault(); loadConversations(conversationSearch).catch((caught) => setError(caught.message)); }}><input className="admin-search" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search member, email, wallet or conversation ID"/><button className="admin-export-button" type="submit">Search conversations</button></form><div className="admin-conversation-layout"><div className="admin-conversation-list">{conversations.map((conversation) => <article key={conversation.id}><header><div><strong>{conversation.customerName}</strong><span>to {conversation.creatorName}</span></div><small>{new Date(conversation.updatedAt).toLocaleString()}</small></header><div><span>{conversation.messageCount} messages</span>{conversation.reportCount > 0 && <span className="warning">{conversation.reportCount} reports</span>}</div><p>{conversation.customerEmail || short(conversation.customerWallet)} → {conversation.creatorEmail || short(conversation.creatorWallet)}</p><button disabled={busy === conversation.id} onClick={() => openTranscript(conversation)}>{busy === conversation.id ? "Opening…" : "Open transcript with reason"}</button></article>)}{!conversations.length && <p className="admin-empty">No conversations found.</p>}</div>{transcript && <aside className="admin-transcript"><header><div><strong>{transcript.conversation.customer.name}</strong><span>with {transcript.conversation.creator.name}</span></div><button onClick={() => setTranscript(null)}>Close</button></header><div className="admin-transcript-audit"><strong>Audited access</strong><span>{transcript.conversation.accessedBy}</span><p>{transcript.conversation.accessReason}</p></div><div className="admin-transcript-thread">{transcript.messages.map((message) => <article className={message.senderRole === "CREATOR" ? "creator" : "customer"} key={message.id}><strong>{message.senderName}</strong><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString()} · {label(message.status)}</small></article>)}</div></aside>}</div></>}
      {tab === "forums" && <><div className="admin-page-heading"><span>COMMUNITY MODERATION</span><h2>Forums</h2><p>Review every topic and reply without changing the public forum layout. Hidden content disappears immediately and every action is recorded.</p></div><div className="admin-forum-list">{forumTopics.map((topic) => <article className={topic.status === "HIDDEN" ? "hidden" : ""} key={topic.id}><header><div><span>{topic.categoryName}</span><h3>{topic.title}</h3><small>{topic.authorName}{topic.authorEmail ? ` · ${topic.authorEmail}` : ""} · {new Date(topic.createdAt).toLocaleString()}</small></div><div className="admin-forum-status"><em>{label(topic.status)}</em>{topic.pinned && <em>Pinned</em>}</div></header><p>{topic.body}</p><div className="admin-forum-meta"><span>{topic.replyCount} visible replies</span>{topic.hiddenReplyCount > 0 && <span>{topic.hiddenReplyCount} hidden</span>}<span>Last activity {new Date(topic.lastActivityAt).toLocaleString()}</span></div><div className="admin-forum-actions"><button disabled={busy === topic.id} onClick={() => moderateForum(topic.pinned ? "UNPIN_TOPIC" : "PIN_TOPIC", topic.id)}>{topic.pinned ? "Unpin" : "Pin"}</button>{topic.status !== "HIDDEN" && <button disabled={busy === topic.id} onClick={() => moderateForum(topic.status === "LOCKED" ? "UNLOCK_TOPIC" : "LOCK_TOPIC", topic.id)}>{topic.status === "LOCKED" ? "Unlock replies" : "Lock replies"}</button>}<button className={topic.status === "HIDDEN" ? "" : "reject"} disabled={busy === topic.id} onClick={() => moderateForum(topic.status === "HIDDEN" ? "RESTORE_TOPIC" : "HIDE_TOPIC", topic.id)}>{topic.status === "HIDDEN" ? "Restore topic" : "Hide with reason"}</button></div>{topic.posts.length > 0 && <details><summary>Review {topic.posts.length} repl{topic.posts.length === 1 ? "y" : "ies"}</summary><div className="admin-forum-posts">{topic.posts.map((post) => <article className={post.status === "HIDDEN" ? "hidden" : ""} key={post.id}><div><strong>{post.authorName}</strong><small>{post.authorEmail || "Wallet member"} · {new Date(post.createdAt).toLocaleString()}</small><p>{post.body}</p></div><button className={post.status === "HIDDEN" ? "" : "reject"} disabled={busy === post.id} onClick={() => moderateForum(post.status === "HIDDEN" ? "RESTORE_POST" : "HIDE_POST", post.id)}>{post.status === "HIDDEN" ? "Restore" : "Hide"}</button></article>)}</div></details>}</article>)}{!forumTopics.length && <p className="admin-empty">No forum topics yet.</p>}</div><div className="admin-section-heading admin-forum-audit-heading"><h3>Recent forum actions</h3></div><div className="admin-audit-list">{forumAudit.map((item) => <article key={item.id}><span>{label(item.action)}</span><strong>{item.topicTitle || "Forum reply"}</strong><p>{item.reason || "No private reason required"}</p><small>{item.actorEmail} · {new Date(item.createdAt).toLocaleString()}</small></article>)}{!forumAudit.length && <p className="admin-empty">No forum moderation actions recorded.</p>}</div></>}
      {tab === "notifications" && <><div className="admin-page-heading"><span>MESSAGE ALERTS</span><h2>Monitored accounts</h2><p>Choose accounts that should alert administrators when they receive a new private message. Alerts identify the account and conversation but never include message contents.</p></div><div className="admin-alert-toolbar"><div><strong>Administrator notifications</strong><span>Alerts are sent to the administrator email addresses configured for this site.</span></div><a className="admin-export-button" href="/api/admin/members/export">Download all member emails (.csv)</a></div><div className="admin-alert-list">{alertAccounts.map((account) => <article className={account.enabled ? "enabled" : ""} key={account.userId}><div><strong>{account.name}</strong><span>{account.email || (account.walletChain ? `${label(account.walletChain)} · ${short(account.walletAddress)}` : "No email or wallet")}</span><small>{account.accountType ? label(account.accountType) : "Role not chosen"}</small></div><button disabled={busy === account.userId} onClick={() => toggleMessageAlert(account)}>{busy === account.userId ? "Saving…" : account.enabled ? "Alerts on" : "Enable alerts"}</button></article>)}{!alertAccounts.length && <p className="admin-empty">No active accounts.</p>}</div></>}
      {tab === "payments" && <><div className="admin-page-heading"><span>SETTLEMENT LEDGER</span><h2>Confirmed payments</h2><p>Verified on-chain likes, gifts and boosts with the 90/10 allocation.</p></div><BaseSettlementSetup/><div className="admin-payment-table"><div className="admin-payment-row head"><span>Event</span><span>Member</span><span>Network</span><span>Gross</span><span>Creator</span><span>Platform</span><span>Date</span></div>{payments.map((payment) => <div className="admin-payment-row" key={payment.id}><span><strong>{label(payment.kind)}</strong><small>{payment.profileName}</small></span><span>{payment.supporter}</span><span>{payment.network}</span><span>{money(payment.grossUsdc)}</span><span>{money(payment.creatorShareUsdc)}</span><span>{money(payment.platformShareUsdc)}</span><span>{new Date(payment.createdAt).toLocaleDateString()}</span>{payment.transactionHashes.length ? <small className="admin-hash-line">{payment.transactionHashes.map((hash) => <a href={explorerUrl(payment.network, hash)} target="_blank" rel="noreferrer" key={hash}>{short(hash)}</a>)}</small> : null}</div>)}{!payments.length && <p className="admin-empty">No confirmed payments.</p>}</div></>}
      {tab === "reports" && <><div className="admin-page-heading"><span>TRUST & SAFETY</span><h2>Safety reports</h2><p>Review reported conduct, related messages and internal case notes.</p></div><section className="review-list">{reports.length === 0 ? <p className="admin-empty">No safety reports.</p> : reports.map((report) => <article className="review-card report-card" key={report.id}><div className="review-copy"><span className={`review-status status-${report.status.toLowerCase()}`}>{label(report.status)}</span><h2>{label(report.category)}</h2><p>{report.details}</p>{report.messageBody && <blockquote>Reported message: “{report.messageBody}”</blockquote>}<p className="report-meta">Profile: {report.profileName || "—"}<br/>Reporter: {report.reporterWallet || "Email account"}<br/>Reported: {report.reportedWallet || "—"}<br/>{new Date(report.createdAt).toLocaleString()}</p>{report.adminNote && <p className="rejection-note">Admin note: {report.adminNote}</p>}<div className="review-actions"><button disabled={busy === report.id} onClick={() => updateReport(report.id, "REVIEWING")}>Reviewing</button><button disabled={busy === report.id} onClick={() => updateReport(report.id, "RESOLVED")}>Resolve</button><button className="reject" disabled={busy === report.id} onClick={() => updateReport(report.id, "DISMISSED")}>Dismiss</button></div></div></article>)}</section></>}
      {tab === "audit" && <><div className="admin-page-heading"><span>ACCOUNTABILITY</span><h2>Administrator audit</h2><p>Recent account moderation and deletion-request actions.</p></div><div className="admin-audit-list">{audit.map((item) => <article key={item.id}><span>{label(item.action)}</span><strong>{item.displayName || item.email || "Deleted account"}</strong><p>{item.note || "No private note"}</p><small>{item.actorEmail || "Legacy administrator"} · {new Date(item.createdAt).toLocaleString()}</small></article>)}{!audit.length && <p className="admin-empty">No account actions recorded.</p>}</div></>}
    </section></div>
  </main>;
}
