"use client";

import { ChangeEvent, DragEvent as ReactDragEvent, FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { InstagramLink } from "@/components/instagram-link";
import { XLink } from "@/components/x-link";
import { REGIONS } from "@/lib/regions";

type Tab = "overview" | "messages" | "profile" | "activity" | "safety" | "settings";
type Identity = {
  email: string | null; walletAddress: string | null; walletChain: string | null;
  wallets: Array<{ address: string; chain: "evm" | "solana"; primary: boolean; verifiedAt: string }>;
  status: string; suspensionReason?: string | null; deletionRequestedAt?: string | null; createdAt: string;
  acceptanceComplete: boolean; adultAttestedAt?: string | null; termsAcceptedAt?: string | null; privacyAcceptedAt?: string | null;
};
type CreatorProfile = {
  id: string; name: string; age: number; region: string; country: string; headline: string; bio: string;
  interests: string[]; reviewStatus: string; rejectionReason?: string | null; messagesSent: number;
  messagesReceived: number; photoLikes: number; discoveryRank: number | null; creatorCount: number | null;
  totalPoints: number; points24h: number;
  photos: ProfilePhoto[];
};
type ProfilePhoto = { id: string; url: string; approved: boolean; paidLikes: number; focalX: number; focalY: number; sortOrder: number };
type MonthlyRatingTier = { level: number; name: string; minimumRating: number; maximumRating: number | null };
type DashboardData = {
  identity: Identity;
  account: { type: "CREATOR" | "CUSTOMER" | null; displayName?: string | null; bio?: string | null; generosityPoints: number };
  creatorProfile: CreatorProfile | null;
  stats: { conversations: number; unread: number; unseenPayments: number; favorites: number; messagesSent: number; supportSentUsdc: number; creatorEarningsUsdc: number; platformFeesUsdc: number };
  monthly: {
    startsAt: string; endsAt: string; supportSentUsdc: number; creatorEarningsUsdc: number;
    sugarDaddyLevel: { level: number; name: string; minimumUsdc: number; nextMinimumUsdc: number | null };
    sugarBabeLevel: { level: number; name: string; minimumUsdc: number; nextMinimumUsdc: number | null };
    sugarDaddyRatingTiers: MonthlyRatingTier[];
    sugarBabeRatingTiers: MonthlyRatingTier[];
  };
  paymentCapabilities: {
    creatorSupportEnabled: boolean;
    creatorSupportNetworks: Array<"evm" | "solana">;
    baseCreatorSupportEnabled: boolean;
    solanaCreatorSupportEnabled: boolean;
  };
  favorites: Array<{ id: string; name: string; region: string; country: string; headline: string; imageUrl?: string | null }>;
  activity: Array<{ id: string; direction: string; kind: string; grossUsdc: number; creatorShareUsdc: number; platformShareUsdc: number; profileName: string; network: string; createdAt: string; transactionHashes: string[] }>;
  reports: Array<{ id: string; category: string; status: string; createdAt: string }>;
};
type Conversation = {
  id: string; counterpartName: string; imageUrl?: string | null; blockedByMe: boolean; blockedMe: boolean;
  priorityBoostUsdc: number; updatedAt: string; consecutiveMessages: number;
  messageGate: "OPEN" | "WARNING" | "REPLY_REQUIRED" | "PAID_UNLOCK_READY";
  hasPaidUnlock: boolean; canPurchaseUnlock: boolean; nextUnlockAt?: string | null;
  messages: Array<{ id: string; body: string; mine: boolean; status: string; boostAmountUsdc: number; createdAt: string }>;
};
type MessageGate = { code: "UNANSWERED_WARNING" | "REPLY_REQUIRED"; error: string; hasPaidUnlock?: boolean; canPurchaseUnlock?: boolean; nextUnlockAt?: string | null };
type PendingPhoto = { id: string; file: File; previewUrl: string; focalX: number; focalY: number };
type RepositionState = {
  kind: "current" | "pending"; id: string; pointerId: number;
  startX: number; startY: number; startFocalX: number; startFocalY: number;
  width: number; height: number; moved: boolean;
};

function money(value: number) { return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC`; }
function short(value?: string | null) { return value ? `${value.slice(0, 7)}…${value.slice(-5)}` : "Not connected"; }
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function explorerUrl(network: string, hash: string) { return network === "SOLANA" ? `https://solscan.io/tx/${hash}` : `https://basescan.org/tx/${hash}`; }
function monthName(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }); }
function sugarRating(value: number) { return Math.max(0, value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"); }

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
  const [accountEmail, setAccountEmail] = useState("");
  const [accountEmailCode, setAccountEmailCode] = useState("");
  const [accountEmailChallengeId, setAccountEmailChallengeId] = useState("");
  const [pendingAccountEmail, setPendingAccountEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [reply, setReply] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerBio, setCustomerBio] = useState("");
  const [profileForm, setProfileForm] = useState({ name: "", age: "", region: "", country: "", headline: "", bio: "", interests: "" });
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [managedPhotos, setManagedPhotos] = useState<ProfilePhoto[]>([]);
  const [photoLayoutSaving, setPhotoLayoutSaving] = useState(false);
  const [draggedPhotoId, setDraggedPhotoId] = useState("");
  const pendingPhotoUrls = useRef<string[]>([]);
  const managedPhotosRef = useRef<ProfilePhoto[]>([]);
  const repositionRef = useRef<RepositionState | null>(null);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ conversationId: string; messageId?: string; label: string } | null>(null);
  const [reportCategory, setReportCategory] = useState("HARASSMENT");
  const [reportDetails, setReportDetails] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [messageGate, setMessageGate] = useState<MessageGate | null>(null);
  const [acceptedAdult, setAcceptedAdult] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptanceStepComplete, setAcceptanceStepComplete] = useState(false);
  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeConversationId) || conversations[0] || null, [conversations, activeConversationId]);
  const acceptanceReady = acceptedAdult && acceptedTerms && acceptedPrivacy;

  async function loadDashboard() {
    setLoading(true); setError("");
    const response = await fetch("/api/dashboard/member", { cache: "no-store" });
    if (response.status === 401) { setSignedOut(true); setData(null); setLoading(false); return; }
    const next = await response.json() as DashboardData & { error?: string };
    if (!response.ok) { setError(next.error || "Dashboard unavailable."); setLoading(false); return; }
    setData(next); setSignedOut(false);
    setAccountEmail(next.identity.email || "");
    managedPhotosRef.current = next.creatorProfile?.photos || [];
    setManagedPhotos(next.creatorProfile?.photos || []);
    setAcceptedAdult(next.identity.acceptanceComplete);
    setAcceptedTerms(next.identity.acceptanceComplete);
    setAcceptedPrivacy(next.identity.acceptanceComplete);
    setAcceptanceStepComplete(next.identity.acceptanceComplete);
    setCustomerName(next.account.displayName || ""); setCustomerBio(next.account.bio || "");
    if (next.creatorProfile) setProfileForm({
      name: next.creatorProfile.name, age: String(next.creatorProfile.age), region: next.creatorProfile.region,
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
  useEffect(() => {
    if (window.location.hash === "#messages") setTab("messages");
    if (window.location.hash === "#activity") setTab("activity");
  }, []);
  useEffect(() => {
    if (tab !== "activity" || !data?.stats.unseenPayments) return;
    let cancelled = false;
    fetch("/api/payments/notifications", { method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error("Payment notifications could not be marked as seen.");
        if (!cancelled) setData((current) => current ? { ...current, stats: { ...current.stats, unseenPayments: 0 } } : current);
      })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, [tab, data?.stats.unseenPayments]);
  useEffect(() => {
    if (!data?.account.type || tab === "activity") return;
    let cancelled = false;
    const refresh = () => fetch("/api/payments/notifications", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ unseenCount?: number }> : null)
      .then((next) => {
        if (!cancelled && next) setData((current) => current ? { ...current, stats: { ...current.stats, unseenPayments: next.unseenCount || 0 } } : current);
      })
      .catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [data?.account.type, tab]);
  useEffect(() => { if (data?.account.type) loadMessages().catch(() => undefined); }, [data?.account.type]);
  useEffect(() => {
    if (tab !== "messages" || !data?.account.type) return;
    const timer = window.setInterval(() => loadMessages().catch(() => undefined), 5_000);
    return () => window.clearInterval(timer);
  }, [tab, data?.account.type]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 4500); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => { setMessageGate(null); }, [activeConversationId]);
  useEffect(() => { setNotificationsEnabled(typeof Notification !== "undefined" && Notification.permission === "granted"); }, []);
  useEffect(() => () => { pendingPhotoUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const existingPhotos = managedPhotos.length;
    const available = Math.max(0, 8 - existingPhotos - pendingPhotos.length);
    if (files.length > available) {
      setError(available > 0 ? `You can select ${available} more photo${available === 1 ? "" : "s"}.` : "Remove a current or selected photo before adding another.");
      return;
    }
    const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) {
      setError(`${invalid.name} must be a JPG, PNG, or WebP smaller than 5 MB.`);
      return;
    }
    const selected = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      pendingPhotoUrls.current.push(previewUrl);
      return { id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`, file, previewUrl, focalX: 50, focalY: 50 };
    });
    setPendingPhotos((current) => [...current, ...selected]);
    setError("");
  }

  function discardPendingPhotos(ids: Set<string>) {
    setPendingPhotos((current) => current.filter((photo) => {
      if (!ids.has(photo.id)) return true;
      URL.revokeObjectURL(photo.previewUrl);
      pendingPhotoUrls.current = pendingPhotoUrls.current.filter((url) => url !== photo.previewUrl);
      return false;
    }));
  }

  function replaceManagedPhotos(next: ProfilePhoto[]) {
    managedPhotosRef.current = next;
    setManagedPhotos(next);
  }

  async function persistPhotoLayout(photos: ProfilePhoto[], showNotice = true) {
    if (!photos.length) return true;
    setPhotoLayoutSaving(true); setError("");
    const response = await fetch("/api/profile/photos", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photos: photos.map((photo) => ({ id: photo.id, focalX: photo.focalX, focalY: photo.focalY })) })
    });
    const next = await response.json() as { error?: string };
    if (!response.ok) {
      setError(next.error || "Your photo arrangement could not be saved.");
      setPhotoLayoutSaving(false);
      return false;
    }
    if (showNotice) setNotice("Photo order and framing saved.");
    setPhotoLayoutSaving(false);
    return true;
  }

  function beginPhotoDrag(event: ReactDragEvent<HTMLElement>, photoId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", photoId);
    setDraggedPhotoId(photoId);
  }

  async function dropPhoto(event: ReactDragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggedPhotoId;
    setDraggedPhotoId("");
    if (!sourceId || sourceId === targetId) return;
    const current = managedPhotosRef.current;
    const sourceIndex = current.findIndex((photo) => photo.id === sourceId);
    const targetIndex = current.findIndex((photo) => photo.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...current];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    replaceManagedPhotos(next.map((photo, sortOrder) => ({ ...photo, sortOrder })));
    await persistPhotoLayout(next, true);
  }

  async function movePhoto(photoId: string, direction: -1 | 1) {
    const current = managedPhotosRef.current;
    const sourceIndex = current.findIndex((photo) => photo.id === photoId);
    const targetIndex = sourceIndex + direction;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.length) return;
    const next = [...current];
    [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
    const ordered = next.map((photo, sortOrder) => ({ ...photo, sortOrder }));
    replaceManagedPhotos(ordered);
    await persistPhotoLayout(ordered, true);
  }

  function beginReposition(event: ReactPointerEvent<HTMLElement>, kind: "current" | "pending", id: string, focalX: number, focalY: number) {
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.closest(".photo-editor-frame")?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
    repositionRef.current = {
      kind, id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      startFocalX: focalX, startFocalY: focalY, width: bounds.width, height: bounds.height, moved: false
    };
  }

  function repositionPhoto(event: ReactPointerEvent<HTMLElement>) {
    const active = repositionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const focalX = Math.round(Math.min(100, Math.max(0, active.startFocalX + ((event.clientX - active.startX) / active.width) * 100)));
    const focalY = Math.round(Math.min(100, Math.max(0, active.startFocalY + ((event.clientY - active.startY) / active.height) * 100)));
    active.moved = active.moved || Math.abs(event.clientX - active.startX) + Math.abs(event.clientY - active.startY) > 2;
    if (active.kind === "current") {
      replaceManagedPhotos(managedPhotosRef.current.map((photo) => photo.id === active.id ? { ...photo, focalX, focalY } : photo));
    } else {
      setPendingPhotos((photos) => photos.map((photo) => photo.id === active.id ? { ...photo, focalX, focalY } : photo));
    }
  }

  async function finishReposition(event: ReactPointerEvent<HTMLElement>) {
    const active = repositionRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    repositionRef.current = null;
    if (active.kind === "current" && active.moved) await persistPhotoLayout(managedPhotosRef.current, true);
  }

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

  async function chooseCustomer(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setError("");
    if (!acceptanceReady) { setError("Confirm that you are 18+ and accept the Terms and Privacy Policy."); setBusy(false); return; }
    const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "CUSTOMER", displayName: customerName, bio: customerBio, acceptedAdult, acceptedTerms, acceptedPrivacy }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Could not save your account."); else { setNotice("Your private Sugar Daddy account is ready."); await loadDashboard(); }
    setBusy(false);
  }

  async function chooseCreator() {
    setBusy(true); setError("");
    if (!acceptanceReady) { setError("Confirm that you are 18+ and accept the Terms and Privacy Policy."); setBusy(false); return; }
    const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "CREATOR", acceptedAdult, acceptedTerms, acceptedPrivacy }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Could not create your Sugar Babe account.");
    else {
      setNotice("Your Sugar Babe account is ready. Add your profile and up to eight photos free.");
      await loadDashboard();
      setTab("profile");
    }
    setBusy(false);
  }

  async function saveCustomer(event: FormEvent) { await chooseCustomer(event); }

  async function acceptPolicies() {
    if (!data?.account.type || !acceptanceReady) { setError("Confirm all three membership statements."); return; }
    setBusy(true); setError("");
    const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      type: data.account.type,
      displayName: data.account.displayName || data.creatorProfile?.name || "Member",
      bio: data.account.bio || "",
      acceptedAdult,
      acceptedTerms,
      acceptedPrivacy
    }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Membership acceptance could not be saved.");
    else { setNotice("Your membership acceptance has been recorded."); await loadDashboard(); }
    setBusy(false);
  }

  async function saveCreator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const files = pendingPhotos;
    const existingPhotos = managedPhotos.length;
    if (existingPhotos + files.length > 8) {
      const excess = existingPhotos + files.length - 8;
      setError(`A creator profile can have up to eight photos. Remove ${excess} photo${excess === 1 ? "" : "s"} before uploading these files.`);
      setBusy(false);
      return;
    }
    const response = await fetch("/api/profiles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...profileForm, age: Number(profileForm.age), interests: profileForm.interests.split(",").map((item) => item.trim()).filter(Boolean)
    }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) { setError(next.error || "Could not save your profile."); setBusy(false); return; }
    let uploadFailed = false;
    let uploadedCount = 0;
    for (const photo of files) {
      const upload = new FormData();
      upload.append("photo", photo.file);
      upload.append("focalX", String(photo.focalX));
      upload.append("focalY", String(photo.focalY));
      const uploaded = await fetch("/api/profile/photos", { method: "POST", body: upload });
      if (!uploaded.ok) { const issue = await uploaded.json() as { error?: string }; setError(issue.error || "One photo could not be uploaded."); uploadFailed = true; break; }
      uploadedCount += 1;
    }
    if (uploadedCount > 0) discardPendingPhotos(new Set(pendingPhotos.slice(0, uploadedCount).map((photo) => photo.id)));
    if (!uploadFailed) setNotice("Your Sugar Babe profile and photos are now published. You can manage them here at any time.");
    await loadDashboard(); setBusy(false);
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    await submitReply();
  }

  async function submitReply(options: { acknowledgeUnansweredWarning?: boolean; usePaidUnlock?: boolean } = {}) {
    if (!activeConversation || !reply.trim()) return;
    setBusy(true); setError("");
    const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: activeConversation.id, body: reply, ...options }) });
    const next = await response.json() as MessageGate & { messageNotice?: string };
    if (!response.ok) {
      if (next.code === "UNANSWERED_WARNING" || next.code === "REPLY_REQUIRED") setMessageGate(next);
      else setError(next.error || "Reply not sent.");
    } else {
      setReply(""); setMessageGate(null);
      if (next.messageNotice) setNotice(next.messageNotice);
      await loadMessages(); await loadDashboard();
    }
    setBusy(false);
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") { setNotice("Browser notifications are not supported on this device."); return; }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
    setNotice(permission === "granted" ? "Private message alerts are enabled in this browser." : "Message alerts were not enabled.");
  }

  async function toggleBlock(conversation: Conversation) {
    const blocked = !conversation.blockedByMe;
    if (blocked && !window.confirm(`Block ${conversation.counterpartName}? Neither account will be able to send new messages until you unblock them.`)) return;
    setSafetyBusy(true); setError("");
    const response = await fetch("/api/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: conversation.id, blocked }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Block setting could not be changed."); else { setNotice(blocked ? "Conversation blocked." : "Conversation unblocked."); await loadMessages(); }
    setSafetyBusy(false);
  }

  function openReport(target: { conversationId: string; messageId?: string; label: string }) {
    setReportTarget(target); setReportCategory("HARASSMENT"); setReportDetails(""); setError("");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!reportTarget) return;
    setSafetyBusy(true); setError("");
    const response = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...reportTarget, category: reportCategory, details: reportDetails }) });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Report could not be submitted.");
    else { setNotice("Your confidential report was submitted."); setReportTarget(null); setReportDetails(""); await loadDashboard(); }
    setSafetyBusy(false);
  }

  async function removePhoto(photoId: string) {
    if (!window.confirm("Remove this photo from your public profile?")) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/profile/photos/${photoId}`, { method: "DELETE" });
    const next = await response.json() as { error?: string };
    if (!response.ok) setError(next.error || "Photo not removed.");
    else { setNotice("Photo removed from your profile."); await loadDashboard(); }
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

  async function requestAccountEmailCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/dashboard/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "REQUEST", email: accountEmail })
    });
    const next = await response.json() as { challengeId?: string; error?: string };
    if (!response.ok || !next.challengeId) setError(next.error || "Could not send a verification code.");
    else {
      setAccountEmailChallengeId(next.challengeId);
      setPendingAccountEmail(accountEmail.trim().toLowerCase());
      setAccountEmailCode("");
      setNotice("Check the new email address for its six-digit verification code.");
    }
    setBusy(false);
  }

  async function confirmAccountEmail(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/dashboard/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "CONFIRM",
        email: pendingAccountEmail,
        code: accountEmailCode,
        challengeId: accountEmailChallengeId
      })
    });
    const next = await response.json() as { verified?: boolean; email?: string; error?: string };
    if (!response.ok || !next.verified) setError(next.error || "That email could not be verified.");
    else {
      setAccountEmailChallengeId("");
      setPendingAccountEmail("");
      setAccountEmailCode("");
      setNotice("Your verified account email has been updated.");
      await loadDashboard();
    }
    setBusy(false);
  }

  async function signOut() { await fetch("/api/auth/logout", { method: "POST" }); setData(null); setSignedOut(true); }

  if (loading) return <main className="member-shell member-loading"><div className="dashboard-spinner"/><p>Opening your private dashboard…</p></main>;
  if (signedOut || !data) return <main className="member-shell"><header className="member-public-header"><a href="/" className="member-brand"><img src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a><div className="member-public-links"><a href="/forums">Forums</a><a href="/">Return home</a></div></header><section className="member-signin"><span>PRIVATE MEMBER ACCESS</span><h1>Your world, in one place.</h1><p>Sign in with your email to open messages, favorites, profile controls and activity.</p>{challengeId ? <form onSubmit={verifyCode}><label>Six-digit code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000"/></label><button disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify & open dashboard"}</button><button className="member-subtle-button" type="button" onClick={() => setChallengeId("")}>Use another email</button></form> : <form onSubmit={requestCode}><label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label><button disabled={busy}>{busy ? "Sending…" : "Email me a sign-in code"}</button></form>}{error && <div className="dashboard-error">{error}</div>}</section></main>;

  const creator = data.account.type === "CREATOR";
  const roleLabel = creator ? "Sugar Babe" : data.account.type === "CUSTOMER" ? "Sugar Daddy" : "New member";
  const hasEvmWallet = data.identity.wallets.some((wallet) => wallet.chain === "evm");
  const hasSolanaWallet = data.identity.wallets.some((wallet) => wallet.chain === "solana");
  return <main className="member-shell">
    <header className="member-topbar"><div className="brand-social"><a className="member-brand" href="/"><img src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a><InstagramLink/><XLink/></div><div><a href="/forums">Forums</a><a href="/">Home</a><button onClick={signOut}>Sign out</button></div></header>
    <div className="member-dashboard-grid">
      <aside className="member-sidebar"><div className="member-identity"><span>{roleLabel}</span><strong>{data.account.displayName || data.creatorProfile?.name || data.identity.email || short(data.identity.walletAddress)}</strong><small>{data.identity.status}</small></div><nav>{(["overview", "messages", "profile", "activity", "safety", "settings"] as Tab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item === "activity" ? "Payments & activity" : item === "settings" ? "Account & Settings" : label(item)}{item === "messages" && data.stats.unread > 0 ? <em>{data.stats.unread}</em> : item === "activity" && data.stats.unseenPayments > 0 ? <em>{data.stats.unseenPayments > 99 ? "99+" : data.stats.unseenPayments}</em> : null}</button>)}</nav></aside>
      <section className="member-content">
        {data.identity.status === "SUSPENDED" && <div className="dashboard-warning"><strong>Account suspended</strong><p>{data.identity.suspensionReason || "Contact safety support for more information."}</p></div>}
        {error && <div className="dashboard-error">{error}</div>}{notice && <div className="dashboard-notice">{notice}</div>}
        {!data.identity.acceptanceComplete && !acceptanceStepComplete ? <section className="dashboard-panel onboarding-panel acceptance-panel"><span className="dashboard-kicker">MEMBERSHIP CONFIRMATION</span><h1>Confirm your membership.</h1><p>These confirmations are recorded with your account when you continue.</p><div className="acceptance-checks"><label><input type="checkbox" checked={acceptedAdult} onChange={(event) => setAcceptedAdult(event.target.checked)}/><span>I attest that I am at least 18 and have reached the age of majority where I live.</span></label><label><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)}/><span>I have read and accept the <a href="/terms" target="_blank">Terms</a>.</span></label><label><input type="checkbox" checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)}/><span>I have read and accept the <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label></div><button disabled={busy || !acceptanceReady} onClick={data.account.type ? acceptPolicies : () => setAcceptanceStepComplete(true)}>{busy ? "Saving…" : "Accept & continue"}</button></section> : !data.account.type ? <section className="dashboard-panel onboarding-panel"><span className="dashboard-kicker">WELCOME</span><h1>Choose how you will use Crypto Sugar.</h1><div className="onboarding-grid"><article><h2>Sugar Babe</h2><p>Submit a public profile, add up to eight photos free, and message free using email. Profiles and photos are reviewed regularly by administrators.</p><button disabled={busy} onClick={chooseCreator}>Continue as Sugar Babe</button></article><article><h2>Sugar Daddy</h2><p>Sugar Daddies stay private, message freely, and connect a wallet only for paid support. Add your display name and bio later in your dashboard.</p><button disabled={busy} onClick={() => chooseCustomer()}>Continue as Sugar Daddy</button></article></div></section> : <>
          {tab === "overview" && <section><div className="dashboard-heading"><span className="dashboard-kicker">PRIVATE OVERVIEW</span><h1>Welcome back, {data.account.displayName || data.creatorProfile?.name || "member"}.</h1><p>{creator ? "Manage your presence, conversations and Sugar Babe activity." : "Your conversations, favorites and Sugar Daddy rank—all kept private."}</p></div><div className="metric-grid"><article><span>Conversations</span><strong>{data.stats.conversations}</strong><small>{data.stats.unread} unread</small></article><article><span>{creator ? "Earnings" : "This month"}</span><strong>{money(creator ? data.stats.creatorEarningsUsdc : data.monthly.supportSentUsdc)}</strong><small>{creator ? "Lifetime total" : `Rank: ${data.monthly.sugarDaddyLevel.name}`}</small></article><article><span>{creator ? "Sugar Rating" : "All time"}</span><strong>{creator ? sugarRating(data.monthly.creatorEarningsUsdc) : money(data.stats.supportSentUsdc)}</strong><small>{creator ? `Sugar Level: ${data.monthly.sugarBabeLevel.name} · ${monthName(data.monthly.startsAt)}` : "\u00a0"}</small></article><article><span>{creator ? "Discovery" : "Messages sent"}</span><strong>{creator && data.creatorProfile?.discoveryRank ? `#${data.creatorProfile.discoveryRank}` : data.stats.messagesSent}</strong><small>{creator && data.creatorProfile?.creatorCount ? `of ${data.creatorProfile.creatorCount} approved Sugar Babes` : "Free private messages"}</small></article></div>{creator && <div className="dashboard-panel monthly-rating-list"><div className="monthly-rating-heading"><div><span>MONTHLY SUGAR RATING</span><h2>Sugar Babe Levels</h2></div><p>1 rating point for every 1 USDC received. Your rating resets each calendar month.</p></div><div className="monthly-rating-tiers">{data.monthly.sugarBabeRatingTiers.map((tier) => <div className={tier.level === data.monthly.sugarBabeLevel.level ? "active" : ""} key={tier.level}><span>LEVEL {tier.level}</span><strong>{tier.name}</strong><small>{tier.maximumRating === null ? `${tier.minimumRating.toLocaleString()}+ rating` : `${tier.minimumRating.toLocaleString()}–${tier.maximumRating.toLocaleString()} rating`}</small></div>)}</div></div>}{creator && data.creatorProfile && <div className="dashboard-panel creator-position"><div><span>24-HOUR DISCOVERY SIGNAL</span><strong>{data.creatorProfile.points24h} points today</strong><p>Recent Sugars, gifts and boosts influence discovery ordering for the current 24-hour period.</p></div><div className={`review-pill ${data.creatorProfile.reviewStatus.toLowerCase()}`}>{label(data.creatorProfile.reviewStatus)}</div></div>}{!creator && <div className="dashboard-panel"><div className="dashboard-panel-title"><h2>Saved Sugar Babes</h2><button onClick={() => setTab("profile")}>View all</button></div><div className="favorite-dashboard-grid">{data.favorites.slice(0, 4).map((item) => <a href={`/?profile=${item.id}`} key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.name[0]}</span>}<strong>{item.name}</strong><small>{item.country} · {item.region}</small></a>)}{!data.favorites.length && <p className="dashboard-empty">Profiles you save will appear here.</p>}</div></div>}</section>}
          {tab === "messages" && <section className="messages-section"><div className="dashboard-heading messages-heading"><span className="dashboard-kicker">PRIVATE MESSAGES</span><h1>Inbox</h1><p>Chat freely. We’ll email you when a new unread message arrives, while keeping the message itself private.</p><div className="message-alert-status"><span aria-hidden="true">✓</span>Email alerts are on{!notificationsEnabled && <button onClick={enableNotifications}>Add browser alerts</button>}</div></div><div className="dashboard-inbox"><aside>{conversations.map((conversation) => <button className={conversation.id === activeConversation?.id ? "active" : ""} key={conversation.id} onClick={() => setActiveConversationId(conversation.id)}>{conversation.imageUrl ? <img src={conversation.imageUrl} alt=""/> : <span>{conversation.counterpartName[0]}</span>}<div><strong>{conversation.counterpartName}{conversation.priorityBoostUsdc > 0 ? <em>BOOST</em> : null}</strong><small>{conversation.messages.at(-1)?.body || "New conversation"}</small></div></button>)}{!conversations.length && <p className="dashboard-empty">No conversations yet.</p>}</aside><div className="dashboard-thread">{activeConversation ? <><header><div className="conversation-person"><span className="conversation-avatar">{activeConversation.imageUrl ? <img src={activeConversation.imageUrl} alt=""/> : activeConversation.counterpartName[0]}</span><div><strong>{activeConversation.counterpartName}</strong><small>{activeConversation.blockedByMe || activeConversation.blockedMe ? "Messaging blocked" : "Private conversation"}</small></div></div><div className="conversation-safety-actions"><button onClick={() => openReport({ conversationId: activeConversation.id, label: `conversation with ${activeConversation.counterpartName}` })}>Report</button><button disabled={safetyBusy} onClick={() => toggleBlock(activeConversation)}>{activeConversation.blockedByMe ? "Unblock" : "Block"}</button></div></header><div>{activeConversation.messages.map((message) => <article className={message.mine ? "mine" : ""} key={message.id}>{message.boostAmountUsdc > 0 && <span>BOOSTED · {money(message.boostAmountUsdc)}</span>}<p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString()}</small>{!message.mine && <button className="message-report" onClick={() => openReport({ conversationId: activeConversation.id, messageId: message.id, label: "message" })}>Report</button>}</article>)}</div>{(messageGate || activeConversation.messageGate !== "OPEN") && <aside className="message-limit-notice"><strong>Crypto Sugar reminder</strong><p>{messageGate?.error || (activeConversation.messageGate === "WARNING" ? "You have sent two messages without a reply. Your third message will require confirmation, then please wait for a reply." : activeConversation.messageGate === "PAID_UNLOCK_READY" ? "Your weekly paid-message unlock is ready. It can be used for one additional message." : "You have sent three messages without a reply. Please wait for a response before continuing.")}</p>{messageGate?.code === "UNANSWERED_WARNING" && <button type="button" disabled={busy || !reply.trim()} onClick={() => submitReply({ acknowledgeUnansweredWarning: true })}>Send third message</button>}{(messageGate?.hasPaidUnlock || activeConversation.hasPaidUnlock) && <button type="button" disabled={busy || !reply.trim()} onClick={() => submitReply({ usePaidUnlock: true })}>Send with paid unlock</button>}{(messageGate?.canPurchaseUnlock || activeConversation.canPurchaseUnlock) && activeConversation.messageGate !== "WARNING" && <a href={`/?unlockConversation=${activeConversation.id}`} target="_blank" rel="noreferrer">Unlock one message · 10 USDC</a>}{!(messageGate?.canPurchaseUnlock || activeConversation.canPurchaseUnlock || messageGate?.hasPaidUnlock || activeConversation.hasPaidUnlock) && (messageGate?.nextUnlockAt || activeConversation.nextUnlockAt) && <small>Next paid unlock: {new Date(messageGate?.nextUnlockAt || activeConversation.nextUnlockAt || "").toLocaleString()}</small>}</aside>}{activeConversation.blockedByMe || activeConversation.blockedMe ? <p className="dashboard-empty">Messaging is disabled for this conversation.</p> : <form onSubmit={sendReply}><textarea required maxLength={800} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a message…"/><button className="message-send-button" disabled={busy}>{busy ? "Sending…" : "Send message"}<span aria-hidden="true">➤</span></button></form>}</> : <div className="dashboard-empty">Choose a conversation.</div>}</div></div></section>}
          {tab === "profile" && <section>
             <div className="dashboard-heading"><span className="dashboard-kicker">{creator ? "SUGAR BABE PROFILE" : "PRIVATE PROFILE"}</span><h1>{creator ? "Your public presence" : "Your private account"}</h1><p>{creator ? "Submit profile changes and new photos here. Profiles and photos are reviewed regularly by administrators." : "Only Sugar Babes you message can see your display name and private introduction."}</p></div>
            <div className="dashboard-panel profile-wallet-panel">
              <div className="profile-wallet-heading">
                <div><span className="dashboard-kicker">CONNECTED WALLETS</span><h2>{data.identity.wallets.length ? "Your wallets" : "Add a wallet"}</h2></div>
                <p>Link Base/EVM and Solana wallets to the same verified account. Each wallet remains separate and is used only on its matching payment network.</p>
              </div>
              {data.identity.wallets.length ? <div className="profile-wallet-list">{data.identity.wallets.map((wallet) => <div key={`${wallet.chain}:${wallet.address}`}><span>{wallet.chain === "solana" ? "Solana" : "Base / EVM"}</span><strong>{short(wallet.address)}</strong><small>{wallet.primary ? "Primary wallet" : "Verified wallet"}</small></div>)}</div> : null}
              <div className="payout-wallet-actions profile-wallet-actions">
                {!hasEvmWallet && <a href="/?connectPayout=1&network=evm&returnTo=dashboard"><span>{hasSolanaWallet ? "Add another wallet" : "Add Base / EVM wallet"}</span><small>MetaMask and other EVM wallets</small></a>}
                {!hasSolanaWallet && <a href="/?connectPayout=1&network=solana&returnTo=dashboard"><span>{hasEvmWallet ? "Add another wallet" : "Add Solana wallet"}</span><small>Solflare or Phantom</small></a>}
                {hasEvmWallet && hasSolanaWallet && <span className="wallet-networks-complete">✓ Base/EVM and Solana are connected</span>}
              </div>
            </div>
            {creator ? <>
              {!data.identity.wallets.length && <div className="dashboard-warning"><strong>Connect a payout wallet to receive paid support</strong><p>{data.paymentCapabilities.baseCreatorSupportEnabled ? "Paid likes, gifts, and boosts support USDC on Solana and Base." : "Paid likes, gifts, and boosts currently use Solana USDC. Base wallets can be linked for sign-in until atomic Base settlement is activated."}</p></div>}
              {hasEvmWallet && !hasSolanaWallet && !data.paymentCapabilities.baseCreatorSupportEnabled && <div className="dashboard-warning"><strong>Base wallet linked for sign-in</strong><p>Paid likes, gifts, and boosts remain disabled until atomic Base settlement is deployed. Add a Solana wallet now to receive USDC support.</p></div>}
              <form className="dashboard-panel dashboard-form" onSubmit={saveCreator}>
                <div className="form-grid"><label>Display name<input required maxLength={80} value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}/></label><label>Age<input required type="number" min={18} max={99} value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}/></label><label>Country<input required maxLength={100} value={profileForm.country} onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}/></label><label>Region<select required value={profileForm.region} onChange={(e) => setProfileForm({ ...profileForm, region: e.target.value })}><option value="" disabled>Select region</option>{REGIONS.map((item) => <option key={item}>{item}</option>)}</select></label></div>
                <label>Headline<input required maxLength={90} value={profileForm.headline} onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })}/></label><label>About<textarea required maxLength={500} value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}/></label><label>Interests · comma separated<input value={profileForm.interests} onChange={(e) => setProfileForm({ ...profileForm, interests: e.target.value })}/></label>
                <label className="photo-upload-field">+ Add photos · free · 8 maximum<input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || managedPhotos.length + pendingPhotos.length >= 8} onChange={selectPhotos}/></label>
                {pendingPhotos.length ? <div className="dashboard-photo-preview-block"><div><strong>Ready to upload</strong><span>{pendingPhotos.length} selected · {managedPhotos.length + pendingPhotos.length}/8 total</span></div><p className="photo-editor-help">Drag each image to frame it.</p><div className="dashboard-photo-grid pending-photo-grid">{pendingPhotos.map((photo, index) => <div className="photo-editor-card" key={photo.id}><div className="photo-editor-frame"><img draggable={false} src={photo.previewUrl} alt={`Selected profile photo ${index + 1}`} style={{ objectPosition: `${photo.focalX}% ${photo.focalY}%` }} onPointerDown={(event) => beginReposition(event, "pending", photo.id, photo.focalX, photo.focalY)} onPointerMove={repositionPhoto} onPointerUp={finishReposition} onPointerCancel={finishReposition}/><span className="reposition-hint">Drag</span></div><small title={photo.file.name}>{photo.file.name}</small><button type="button" disabled={busy} onClick={() => discardPendingPhotos(new Set([photo.id]))}>Remove</button></div>)}</div></div> : null}
                {managedPhotos.length ? <div className="dashboard-current-photos"><div className="current-photo-heading"><div><strong>Current photos</strong><p>Drag cards to reorder. Drag the strip to frame a photo.</p></div>{photoLayoutSaving ? <span>Saving…</span> : <span>Auto-saved</span>}</div><div className="dashboard-photo-grid">{managedPhotos.map((photo, index) => <div className={`photo-editor-card ${draggedPhotoId === photo.id ? "dragging" : ""}`} key={photo.id} draggable={!busy && !photoLayoutSaving} onDragStart={(event) => beginPhotoDrag(event, photo.id)} onDragEnd={() => setDraggedPhotoId("")} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => dropPhoto(event, photo.id)} aria-label={`Drag photo ${index + 1} to reorder`}><div className="photo-card-toolbar"><button className="photo-drag-handle" type="button" aria-label={`Drag photo ${index + 1} to reorder`}><span aria-hidden="true">⋮⋮</span> Drag</button>{index === 0 ? <span>Display</span> : null}</div><div className="photo-editor-frame"><img draggable={false} src={photo.url} alt={`Current profile photo ${index + 1}`} style={{ objectPosition: `${photo.focalX}% ${photo.focalY}%` }}/><span className="reposition-hint" onPointerDown={(event) => beginReposition(event, "current", photo.id, photo.focalX, photo.focalY)} onPointerMove={repositionPhoto} onPointerUp={finishReposition} onPointerCancel={finishReposition}>Drag</span></div><small>{photo.approved ? "Published" : "Hidden"} · {photo.paidLikes} likes</small><div className="photo-card-actions">{index > 0 ? <button type="button" disabled={busy || photoLayoutSaving} onClick={() => movePhoto(photo.id, -1)} aria-label="Move photo left" title="Move left">←</button> : null}{index < managedPhotos.length - 1 ? <button type="button" disabled={busy || photoLayoutSaving} onClick={() => movePhoto(photo.id, 1)} aria-label="Move photo right" title="Move right">→</button> : null}<button type="button" disabled={busy || photoLayoutSaving} onClick={() => removePhoto(photo.id)}>Remove</button></div></div>)}</div></div> : null}
                <button className="creator-save-button" disabled={busy || photoLayoutSaving}>{busy ? "Saving…" : "Submit changes"}</button>{data.creatorProfile?.rejectionReason && <div className="dashboard-warning"><strong>Administrator review note</strong><p>{data.creatorProfile.rejectionReason}</p></div>}
              </form>
            </> : <><form className="dashboard-panel dashboard-form" onSubmit={saveCustomer}><label>Private display name<input required maxLength={80} value={customerName} onChange={(event) => setCustomerName(event.target.value)}/></label><label>Private introduction<textarea maxLength={300} value={customerBio} onChange={(event) => setCustomerBio(event.target.value)}/></label><button disabled={busy}>Save private profile</button></form><div className="dashboard-panel"><div className="dashboard-panel-title"><h2>Favorites</h2><span>{data.favorites.length}</span></div><div className="favorite-dashboard-grid">{data.favorites.map((item) => <a href={`/?profile=${item.id}`} key={item.id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.name[0]}</span>}<strong>{item.name}</strong><small>{item.country} · {item.region}</small></a>)}{!data.favorites.length && <p className="dashboard-empty">No saved Sugar Babes yet.</p>}</div></div></>}
          </section>}
          {tab === "activity" && <section><div className="dashboard-heading"><span className="dashboard-kicker">ON-CHAIN LEDGER</span><h1>Payments & activity</h1><p>Confirmed likes, gifts and boosts with their Sugar Babe/platform split.</p></div><div className="dashboard-panel activity-table"><div className="table-row table-head"><span>Activity</span><span>Network</span><span>Gross</span><span>{creator ? "Your share" : "Sugar Babe share"}</span><span>Date</span></div>{data.activity.map((item) => <div className="table-row" key={item.id}><span><strong>{label(item.kind)}</strong><small>{item.direction === "SENT" ? `To ${item.profileName}` : `From a supporter`}</small></span><span>{item.network}</span><span>{money(item.grossUsdc)}</span><span>{money(item.creatorShareUsdc)}</span><span>{new Date(item.createdAt).toLocaleDateString()}</span>{item.transactionHashes.length ? <small className="transaction-line">{item.transactionHashes.map((hash) => <a href={explorerUrl(item.network, hash)} target="_blank" rel="noreferrer" key={hash}>{short(hash)}</a>)}</small> : null}</div>)}{!data.activity.length && <p className="dashboard-empty">No confirmed payment activity yet.</p>}</div></section>}
          {tab === "safety" && <section><div className="dashboard-heading"><span className="dashboard-kicker">SAFETY CENTER</span><h1>Your safety controls</h1><p>Track reports and use the inbox to block or report a conversation.</p></div><div className="dashboard-panel"><div className="dashboard-panel-title"><h2>Submitted reports</h2><a href="mailto:email@cryptosugarbabes.com?subject=Safety%20report">Contact safety</a></div>{data.reports.map((report) => <div className="safety-report-row" key={report.id}><strong>{label(report.category)}</strong><span className={`review-pill ${report.status.toLowerCase()}`}>{label(report.status)}</span><small>{new Date(report.createdAt).toLocaleString()}</small></div>)}{!data.reports.length && <p className="dashboard-empty">You have not submitted any reports.</p>}</div><div className="dashboard-panel safety-links"><a href="/safety">Safety policy</a><a href="/disputes">Disputes</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div></section>}
          {tab === "settings" && <section>
            <div className="dashboard-heading"><span className="dashboard-kicker">ACCOUNT & PRIVACY</span><h1>Account & Settings</h1><p>Manage your sign-in details, connected wallet, social links and privacy requests.</p></div>
            <div className="dashboard-panel identity-list"><div><span>Verified email</span><strong>{data.identity.email || "Required before linking a wallet"}</strong></div>{data.identity.wallets.length ? data.identity.wallets.map((wallet) => <div key={`${wallet.chain}:${wallet.address}`}><span>{wallet.chain === "solana" ? "Solana wallet" : "Base / EVM wallet"}</span><strong>{short(wallet.address)}</strong><small>{wallet.primary ? "Primary payout wallet" : "Verified wallet"}</small></div>) : <div><span>Wallets</span><strong>None connected</strong><small>Verify email, then link Base and/or Solana</small></div>}<div><span>Member since</span><strong>{new Date(data.identity.createdAt).toLocaleDateString()}</strong></div><div><span>Account status</span><strong>{label(data.identity.status)}</strong></div></div>
            <div className="payout-wallet-actions"><a href="/?connectPayout=1&network=evm&returnTo=dashboard">Link Base / EVM wallet</a><a href="/?connectPayout=1&network=solana&returnTo=dashboard">Link Solana wallet</a></div>
            <div className="dashboard-panel account-email-panel">
              <div><span className="dashboard-kicker">VERIFIED EMAIL</span><h2>{data.identity.email ? "Change your email address" : "Verify your required email address"}</h2><p>{data.identity.email ? "We will send a code to the new address before replacing your current email. You will use the new address the next time you sign in." : "Verify an email before linking a new Base or Solana wallet. It also enables password-free sign-in and private message notifications."}</p></div>
              {accountEmailChallengeId ? <form onSubmit={confirmAccountEmail}>
                <label>Verification code sent to {pendingAccountEmail}<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={accountEmailCode} onChange={(event) => setAccountEmailCode(event.target.value.replace(/\D/g, ""))} placeholder="000000"/></label>
                <div className="account-email-actions"><button disabled={busy || accountEmailCode.length !== 6}>{busy ? "Verifying…" : "Verify & save email"}</button><button className="member-subtle-button" type="button" disabled={busy} onClick={() => { setAccountEmailChallengeId(""); setPendingAccountEmail(""); setAccountEmailCode(""); setAccountEmail(data.identity.email || ""); }}>Cancel</button></div>
              </form> : <form onSubmit={requestAccountEmailCode}>
                <label>Verified email address · required for wallet linking<input type="email" required value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="you@example.com"/></label>
                <button disabled={busy || !accountEmail.trim() || accountEmail.trim().toLowerCase() === data.identity.email}>{busy ? "Sending…" : data.identity.email ? "Verify new email" : "Add & verify email"}</button>
              </form>}
            </div>
            <div className="dashboard-panel social-follow-panel"><div><span>Social updates</span><h2>Stay connected</h2><p>Follow our official accounts for announcements and community updates. This does not give Crypto Sugar access to your social accounts.</p></div><div className="social-follow-actions"><a href="https://www.instagram.com/cryptosugarbabes/" target="_blank" rel="noopener noreferrer">Instagram <small>@cryptosugarbabes</small></a><a href="https://x.com/cryptosugarking" target="_blank" rel="noopener noreferrer">X <small>@cryptosugarking</small></a></div></div>
            <div className="dashboard-panel deletion-panel"><h2>Account deletion</h2>{data.identity.deletionRequestedAt ? <><p>Your request was submitted on {new Date(data.identity.deletionRequestedAt).toLocaleDateString()}. An administrator will review required safety, dispute and transaction-retention obligations before deletion or anonymisation.</p><button disabled={busy} onClick={() => deletion("CANCEL_DELETION")}>Cancel deletion request</button></> : <><p>This sends a formal deletion request. Confirmed blockchain records cannot be erased from the network, but we can remove or anonymise eligible platform data.</p><label>Type DELETE to confirm<input value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)}/></label><button className="danger-button" disabled={busy || deletionConfirmation !== "DELETE"} onClick={() => deletion("REQUEST_DELETION")}>Request account deletion</button></>}</div>
          </section>}
        </>}
      </section>
    </div>
    {reportTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !safetyBusy) setReportTarget(null); }}><section className="message-modal report-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-report-title"><button className="modal-close" onClick={() => setReportTarget(null)} aria-label="Close report">×</button><span className="section-kicker">CONFIDENTIAL SAFETY REPORT</span><h2 id="dashboard-report-title">Report {reportTarget.label}.</h2><p className="wallet-intro">Reports are reviewed by an administrator. If someone may be in immediate danger, contact local emergency services.</p><form onSubmit={submitReport}><label><span>CATEGORY</span><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="HARASSMENT">Harassment or threats</option><option value="SPAM">Spam</option><option value="SCAM">Scam or fraud</option><option value="EXTORTION">Extortion</option><option value="UNDERAGE">Suspected underage user</option><option value="TRAFFICKING">Trafficking or coercion</option><option value="IMPERSONATION">Impersonation</option><option value="OTHER">Other safety concern</option></select></label><label className="message-field"><span>WHAT HAPPENED?</span><textarea required minLength={10} maxLength={1500} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Add dates, context, and specific conduct. Never include a recovery phrase or private key."/><small>{reportDetails.length}/1500</small></label><button className="primary-button full" type="submit" disabled={safetyBusy}>{safetyBusy ? "Submitting…" : "Submit confidential report"}</button></form></section></div>}
  </main>;
}
