"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { base } from "viem/chains";
import { createPublicClient, createWalletClient, custom, erc20Abi, getAddress, http, keccak256, stringToHex } from "viem";
import { Profile } from "@/lib/profiles";
import { REGIONS } from "@/lib/regions";
import { trackProductEvent } from "@/lib/client-observability";
import { InstagramLink } from "@/components/instagram-link";
import { XLink } from "@/components/x-link";
import {
  creatorShareUsdc,
  creatorSupportPoints,
  formatUsdc,
  generosityLevel,
  generosityPoints,
  photoLikePriceUsdc,
  platformShareUsdc
} from "@/lib/creator-economy";

type WalletChain = "evm" | "solana";
type EthereumProvider = {
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  providers?: EthereumProvider[];
  isMetaMask?: boolean;
  isTrust?: boolean;
  isBinance?: boolean;
  isCoinbaseWallet?: boolean;
};
type SolanaPublicKey = { toString: () => string };
type SolanaProvider = {
  publicKey?: SolanaPublicKey;
  connect: () => Promise<{ publicKey?: SolanaPublicKey }>;
  disconnect?: () => Promise<void>;
  signMessage: (message: Uint8Array, display?: string) => Promise<Uint8Array | { signature: Uint8Array }>;
  signAndSendTransaction?: (transaction: unknown) => Promise<string | { signature: string }>;
  isPhantom?: boolean;
  isSolflare?: boolean;
};

type AccountType = "CREATOR" | "CUSTOMER";
type ConversationMessage = { id: string; body: string; mine: boolean; status: string; boostAmountUsdc?: number; boostedAt?: string | null; createdAt: string };
type Conversation = { id: string; profileId: string; counterpartName: string; creatorName: string; imageUrl?: string | null; blockedByMe?: boolean; blockedMe?: boolean; priorityBoostUsdc?: number; consecutiveMessages: number; messageGate: "OPEN" | "WARNING" | "REPLY_REQUIRED" | "PAID_UNLOCK_READY"; hasPaidUnlock: boolean; canPurchaseUnlock: boolean; nextUnlockAt?: string | null; updatedAt: string; messages: ConversationMessage[] };
type PaymentKind = "PAID_LIKE" | "GIFT" | "MESSAGE_BOOST" | "MESSAGE_UNLOCK";
type MessageGate = { code: "UNANSWERED_WARNING" | "REPLY_REQUIRED"; conversationId: string; error: string; hasPaidUnlock?: boolean; canPurchaseUnlock?: boolean; nextUnlockAt?: string | null };
type PaymentQuote = {
  quoteId: string;
  kind: PaymentKind;
  network: "BASE" | "SOLANA";
  grossMicros: string;
  creatorMicros: string;
  platformMicros: string;
  grossAmountUsdc: string;
  creatorAmountUsdc: string;
  platformAmountUsdc: string;
  creatorAddress: string;
  treasuryAddress: string;
  tokenAddress: string;
  splitterAddress?: string | null;
  mediaId?: string | null;
  messageId?: string | null;
  conversationId?: string | null;
  expiresAt: string;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    binancew3w?: { ethereum?: EthereumProvider };
    trustwallet?: { ethereum?: EthereumProvider };
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
  }
}

const BASE_CHAIN_ID = "0x2105";
const emptyProfile = {
  name: "",
  age: "",
  region: "",
  country: "",
  headline: "",
  bio: "",
  interests: ""
};

const walletSetupLinks = [
  { name: "MetaMask", network: "Base", mark: "M", tone: "metamask", href: "https://metamask.io/download/" },
  { name: "Binance", network: "Base", mark: "B", tone: "binance", href: "https://www.binance.com/en/web3wallet" },
  { name: "Trust", network: "Base", mark: "T", tone: "trust", href: "https://trustwallet.com/download" },
  { name: "Rabby", network: "Base", mark: "R", tone: "rabby", href: "https://rabby.io/" },
  { name: "Coinbase", network: "Base", mark: "C", tone: "coinbase", href: "https://wallet.coinbase.com/" },
  { name: "Solflare", network: "Solana", mark: "S", tone: "solflare", href: "https://www.solflare.com/" },
  { name: "Phantom", network: "Solana", mark: "P", tone: "phantom", href: "https://phantom.com/download" }
] as const;

const iconPaths: Record<string, React.ReactNode> = {
  compass: <><circle cx="12" cy="12" r="9"/><path d="m15.2 8.8-2 4.4-4.4 2 2-4.4 4.4-2Z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z"/><path d="M16 10h5v4h-5a2 2 0 0 1 0-4Z"/></>,
  shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8.2 7 10 4.2-1.8 7-5.3 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  heart: <path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
  close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
  spark: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/></>,
  solana: <><path d="M7 5h12l-2 2H5l2-2ZM5 11h12l2 2H7l-2-2ZM7 17h12l-2 2H5l2-2Z"/></>
};

function Icon({ name, size = 20, filled = false }: { name: string; size?: number; filled?: boolean }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function shortAddress(address: string) {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function paymentErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "The payment was not completed.";
  if (/internal error/i.test(message)) {
    return "Your Solana wallet could not submit the payment. Reopen Solflare or Phantom, confirm the same account is connected, and try again. No payment was recorded.";
  }
  return message;
}

async function switchToBase(provider: EthereumProvider) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_CHAIN_ID }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID, chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] }]
    });
  }
}

type EvmWalletKind = "browser" | "binance" | "trust";

function injectedEvmProvider(kind: EvmWalletKind) {
  if (kind === "binance" && window.binancew3w?.ethereum) return window.binancew3w.ethereum;
  if (kind === "trust" && window.trustwallet?.ethereum) return window.trustwallet.ethereum;

  const defaultProvider = window.ethereum;
  const providers = defaultProvider?.providers?.length ? defaultProvider.providers : defaultProvider ? [defaultProvider] : [];
  if (kind === "binance") return providers.find((provider) => provider.isBinance);
  if (kind === "trust") return providers.find((provider) => provider.isTrust);
  return providers.find((provider) => provider.isMetaMask && !provider.isTrust) || providers.find((provider) => provider.isCoinbaseWallet) || defaultProvider;
}

function ProfileArtwork({ profile, large = false }: { profile: Profile; large?: boolean }) {
  return (
    <div className={`${large ? "modal-visual" : "profile-visual"} motif-${profile.motif}`} style={{ "--tone-one": profile.colors[0], "--tone-two": profile.colors[1], "--tone-three": profile.colors[2] } as React.CSSProperties}>
      {profile.imageUrl ? <img src={profile.imageUrl} alt="" style={{ objectPosition: `${profile.imagePosition?.x ?? 50}% ${profile.imagePosition?.y ?? 50}%` }}/> : <><div className="moon"/><div className="horizon horizon-back"/><div className="horizon horizon-front"/><span className={large ? "modal-monogram" : "profile-monogram"}>{profile.initials}</span></>}
      {profile.sample && <span className="sample-photo-badge">EDITORIAL SAMPLE</span>}
      {!large && profile.online && <span className="profile-online">ONLINE</span>}
    </div>
  );
}

export function DiscoveryApp() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("Anywhere");
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletChain, setWalletChain] = useState<WalletChain | null>(null);
  const [walletName, setWalletName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [emailAuthOpen, setEmailAuthOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailChallengeId, setEmailChallengeId] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [walletContext, setWalletContext] = useState<"general" | "profile">("general");
  const [walletNetworkFilter, setWalletNetworkFilter] = useState<WalletChain | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [profilePhotos, setProfilePhotos] = useState<string[]>([]);
  const [profileFiles, setProfileFiles] = useState<File[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [customProfiles, setCustomProfiles] = useState<Profile[]>([]);
  const [engagement, setEngagement] = useState<Record<string, { messages: number; likes: number; giftsUsdc: number }>>({});
  const [messageTarget, setMessageTarget] = useState<Profile | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messageBoostAmount, setMessageBoostAmount] = useState("");
  const [giftTarget, setGiftTarget] = useState<Profile | null>(null);
  const [giftAmount, setGiftAmount] = useState("25");
  const [supportGivenUsdc, setSupportGivenUsdc] = useState(0);
  const [notice, setNotice] = useState("");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [hasCreatorProfile, setHasCreatorProfile] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountDisplayName, setAccountDisplayName] = useState("");
  const [accountBio, setAccountBio] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [acceptanceComplete, setAcceptanceComplete] = useState(false);
  const [acceptedAdult, setAcceptedAdult] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageGate, setMessageGate] = useState<MessageGate | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unseenPaymentCount, setUnseenPaymentCount] = useState(0);
  const [reportTarget, setReportTarget] = useState<{ profileId?: string; conversationId?: string; messageId?: string; label: string } | null>(null);
  const [reportCategory, setReportCategory] = useState("HARASSMENT");
  const [reportDetails, setReportDetails] = useState("");
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentExpiresAt, setPaymentExpiresAt] = useState<string | null>(null);
  const [paymentClock, setPaymentClock] = useState(Date.now());
  const [basePaymentsLive, setBasePaymentsLive] = useState(false);
  const evmProviderRef = useRef<EthereumProvider | null>(null);
  const solanaProviderRef = useRef<SolanaProvider | null>(null);
  const profileIntentRef = useRef(false);
  const lastUnreadRef = useRef(0);
  const regionMenuRef = useRef<HTMLDivElement | null>(null);
  const isAuthenticated = Boolean(wallet || email);
  const acceptanceReady = acceptedAdult && acceptedTerms && acceptedPrivacy;

  function showWalletPicker(_context: "general" | "profile" = "general", network: WalletChain | null = null) {
    setWalletContext(_context);
    setWalletNetworkFilter(network);
    setWalletPickerOpen(true);
  }

  function showEmailSignIn() {
    trackProductEvent("SIGN_IN_OPENED");
    setWalletError("");
    setEmailCode("");
    setEmailChallengeId("");
    setEmailAuthOpen(true);
  }

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then(async (data: { authenticated: boolean; email: string | null; address: string | null; chain: WalletChain | null }) => {
      setEmail(data.email);
      setWallet(data.address);
      setWalletChain(data.chain);
      if (data.chain) setWalletName(data.chain === "solana" ? "Solana" : "Base");
      if (data.authenticated) await Promise.all([loadAccount(true), loadFavorites()]);
      const params = new URLSearchParams(window.location.search);
      if (params.get("signin") === "1" && !data.authenticated) showEmailSignIn();
      if (params.get("account") === "1" && data.authenticated) setAccountOpen(true);
      if (params.get("connectPayout") === "1" && data.authenticated && !data.address) {
        const requestedNetwork = params.get("network") === "solana" ? "solana" : params.get("network") === "evm" ? "evm" : null;
        showWalletPicker("general", requestedNetwork);
        setNotice("Choose the payout wallet you want to link to this creator account.");
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!regionMenuOpen) return;

    function closeRegionMenu(event: PointerEvent) {
      if (!regionMenuRef.current?.contains(event.target as Node)) setRegionMenuOpen(false);
    }

    function handleRegionMenuKey(event: KeyboardEvent) {
      if (event.key === "Escape") setRegionMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeRegionMenu);
    document.addEventListener("keydown", handleRegionMenuKey);
    return () => {
      document.removeEventListener("pointerdown", closeRegionMenu);
      document.removeEventListener("keydown", handleRegionMenuKey);
    };
  }, [regionMenuOpen]);

  async function requestEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailBusy(true); setWalletError("");
    try {
      const response = await fetch("/api/auth/email/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: emailAddress }) });
      const data = await response.json() as { sent?: boolean; challengeId?: string; error?: string };
      if (!response.ok || !data.challengeId) throw new Error(data.error || "The sign-in code could not be sent.");
      setEmailChallengeId(data.challengeId);
      setEmailCode("");
      setNotice("Check your email for a six-digit sign-in code.");
    } catch (error) { setWalletError(error instanceof Error ? error.message : "The sign-in code could not be sent."); }
    finally { setEmailBusy(false); }
  }

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailBusy(true); setWalletError("");
    try {
      const response = await fetch("/api/auth/email/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: emailAddress, code: emailCode, challengeId: emailChallengeId }) });
      const data = await response.json() as { authenticated?: boolean; email?: string; error?: string };
      if (!response.ok || !data.authenticated || !data.email) throw new Error(data.error || "The sign-in code could not be verified.");
      setEmail(data.email);
      setEmailAuthOpen(false);
      const [, account] = await Promise.all([loadFavorites(), loadAccount(true)]);
      if (profileIntentRef.current && account?.type === "CREATOR") {
        profileIntentRef.current = false;
        setProfileOpen(true);
      }
      setNotice(account?.type ? "Signed in. Messaging and profiles are ready." : "Email verified. Choose your account type next.");
    } catch (error) { setWalletError(error instanceof Error ? error.message : "The sign-in code could not be verified."); }
    finally { setEmailBusy(false); }
  }

  async function loadPersistedProfiles() {
    const response = await fetch("/api/profiles", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { profiles?: Profile[] };
    setCustomProfiles(data.profiles || []);
  }

  async function loadAccount(openWhenMissing = false) {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json() as { account?: { type: AccountType | null; displayName?: string | null; bio?: string | null; generosityPoints?: number; hasCreatorProfile?: boolean; acceptance?: { complete?: boolean } } | null };
    const account = data.account || null;
    setAccountType(account?.type || null);
    setHasCreatorProfile(Boolean(account?.hasCreatorProfile));
    setAccountDisplayName(account?.displayName || "");
    setAccountBio(account?.bio || "");
    const complete = Boolean(account?.acceptance?.complete);
    setAcceptanceComplete(complete);
    setAcceptedAdult(complete);
    setAcceptedTerms(complete);
    setAcceptedPrivacy(complete);
    if (account?.generosityPoints) setSupportGivenUsdc(account.generosityPoints);
    if (openWhenMissing && (!account?.type || !complete)) setAccountOpen(true);
    return account;
  }

  async function loadFavorites() {
    const response = await fetch("/api/favorites", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { profileIds?: string[] };
    setFavorites(new Set(data.profileIds || []));
  }

  async function loadMessages(open = false) {
    const response = await fetch("/api/messages", { cache: "no-store" });
    const data = await response.json() as { conversations?: Conversation[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Messages could not be loaded.");
    const next = data.conversations || [];
    setConversations(next);
    setUnreadCount(0);
    lastUnreadRef.current = 0;
    if (!activeConversationId && next[0]) setActiveConversationId(next[0].id);
    if (open) setInboxOpen(true);
  }

  async function loadUnread() {
    const response = await fetch("/api/messages/unread", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { unreadCount?: number };
    const next = data.unreadCount || 0;
    if (next > lastUnreadRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Crypto Sugar Babes", { body: `You have ${next} unread message${next === 1 ? "" : "s"}.`, icon: "/icon.png" });
    }
    lastUnreadRef.current = next;
    setUnreadCount(next);
  }

  async function loadPaymentNotifications() {
    const response = await fetch("/api/payments/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { unseenCount?: number };
    setUnseenPaymentCount(data.unseenCount || 0);
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") { setNotice("Browser notifications are not supported on this device."); return; }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
    setNotice(permission === "granted" ? "Private unread-message alerts are enabled on this device." : "Notification permission was not enabled.");
  }

  async function openInbox() {
    if (!isAuthenticated) { showEmailSignIn(); return; }
    if (!accountType) { setAccountOpen(true); return; }
    try { await loadMessages(true); } catch (error) { setWalletError(error instanceof Error ? error.message : "Messages could not be loaded."); }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitReply();
  }

  async function submitReply(options: { acknowledgeUnansweredWarning?: boolean; usePaidUnlock?: boolean } = {}) {
    if (!activeConversationId || !replyText.trim()) return;
    setMessageBusy(true); setWalletError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: activeConversationId, body: replyText, ...options }) });
      const data = await response.json() as MessageGate & { messageNotice?: string };
      if (!response.ok) {
        if (data.code === "UNANSWERED_WARNING" || data.code === "REPLY_REQUIRED") { setMessageGate(data); return; }
        throw new Error(data.error || "Your reply could not be sent.");
      }
      setReplyText("");
      setMessageGate(null);
      if (data.messageNotice) setNotice(data.messageNotice);
      await loadMessages(false);
    } catch (error) { setWalletError(error instanceof Error ? error.message : "Your reply could not be sent."); }
    finally { setMessageBusy(false); }
  }

  async function toggleBlock(conversation: Conversation) {
    const blocked = !conversation.blockedByMe;
    if (blocked && !window.confirm(`Block ${conversation.counterpartName}? Neither account will be able to send new messages until you unblock them.`)) return;
    setSafetyBusy(true); setWalletError("");
    try {
      const response = await fetch("/api/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: conversation.id, blocked }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The block setting could not be changed.");
      await loadMessages(false);
      setNotice(blocked ? `${conversation.counterpartName} was blocked.` : `${conversation.counterpartName} was unblocked.`);
    } catch (error) { setWalletError(error instanceof Error ? error.message : "The block setting could not be changed."); }
    finally { setSafetyBusy(false); }
  }

  function openReport(target: { profileId?: string; conversationId?: string; messageId?: string; label: string }) {
    if (!isAuthenticated) { setWalletError("Sign in before submitting a safety report."); showEmailSignIn(); return; }
    setReportTarget(target); setReportCategory("HARASSMENT"); setReportDetails("");
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportTarget) return;
    setSafetyBusy(true); setWalletError("");
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...reportTarget, category: reportCategory, details: reportDetails }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The safety report could not be submitted.");
      setReportTarget(null); setReportDetails("");
      setNotice("Your safety report was submitted for administrator review.");
    } catch (error) { setWalletError(error instanceof Error ? error.message : "The safety report could not be submitted."); }
    finally { setSafetyBusy(false); }
  }

  useEffect(() => {
    loadPersistedProfiles().catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/payments/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { base?: { atomicSettlementEnabled?: boolean } }) => setBasePaymentsLive(Boolean(data.base?.atomicSettlementEnabled)))
      .catch(() => setBasePaymentsLive(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !accountType) { setUnreadCount(0); setUnseenPaymentCount(0); return; }
    Promise.all([loadUnread(), loadPaymentNotifications()]).catch(() => undefined);
    const timer = window.setInterval(() => Promise.all([loadUnread(), loadPaymentNotifications()]).catch(() => undefined), 30_000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, accountType]);

  useEffect(() => {
    if (!inboxOpen || !isAuthenticated || !accountType) return;
    const timer = window.setInterval(() => loadMessages(false).catch(() => undefined), 5_000);
    return () => window.clearInterval(timer);
  }, [inboxOpen, isAuthenticated, accountType]);

  useEffect(() => {
    if (!isAuthenticated || !accountType) return;
    const requestedConversation = new URLSearchParams(window.location.search).get("unlockConversation");
    if (!requestedConversation) return;
    loadMessages(true).then(() => setActiveConversationId(requestedConversation)).catch(() => setWalletError("That conversation could not be opened."));
  }, [isAuthenticated, accountType]);

  useEffect(() => { setMessageGate(null); }, [activeConversationId, messageTarget?.id]);

  useEffect(() => {
    setNotificationsEnabled(typeof Notification !== "undefined" && Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (!paymentExpiresAt) return;
    const timer = window.setInterval(() => setPaymentClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [paymentExpiresAt]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const allProfiles = useMemo(() => customProfiles, [customProfiles]);
  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allProfiles.filter((profile) => {
      const matchesRegion = region === "Anywhere" || profile.region === region;
      const matchesQuery = !needle || [profile.name, profile.region, profile.country, profile.headline, ...profile.tags].join(" ").toLowerCase().includes(needle);
      return matchesRegion && matchesQuery;
    });
  }, [allProfiles, region, query]);

  async function requestSignIn(address: string, chain: WalletChain) {
    const response = await fetch("/api/auth/nonce", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, chain }) });
    const data = (await response.json()) as { message?: string; error?: string };
    if (!response.ok || !data.message) throw new Error(data.error || "Could not start sign-in.");
    return data.message;
  }

  async function verifySignIn(address: string, chain: WalletChain, message: string, signature: string, name: string) {
    const response = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, chain, message, signature }) });
    const data = (await response.json()) as { address?: string; chain?: WalletChain; email?: string | null; error?: string };
    if (!response.ok || !data.address) throw new Error(data.error || "Sign-in failed.");
    setWallet(data.address);
    if (data.email) setEmail(data.email);
    setWalletChain(data.chain || chain);
    setWalletName(name);
    setWalletPickerOpen(false);
    const [, account] = await Promise.all([loadPersistedProfiles(), loadAccount(true), loadFavorites()]);
    const params = new URLSearchParams(window.location.search);
    if (params.has("connectPayout")) {
      params.delete("connectPayout");
      params.delete("network");
      const cleanUrl = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", cleanUrl);
    }
    setNotice(account?.type === "CREATOR"
      ? chain === "solana"
        ? `${name} linked. Paid likes, gifts, and boosts are now enabled for your creator profile.`
        : basePaymentsLive
          ? `${name} linked. Paid likes, gifts, and boosts are now enabled on Base.`
          : `${name} linked for Base sign-in. Connect Solana to enable paid likes, gifts, and boosts while Base settlement is activated.`
      : `${name} connected. Welcome to Crypto Sugar.`);
    if (profileIntentRef.current && account?.type === "CREATOR") {
      profileIntentRef.current = false;
      setProfileOpen(true);
    } else if (profileIntentRef.current && account?.type === "CUSTOMER") {
      profileIntentRef.current = false;
      setNotice("Sugar Daddy accounts stay private and cannot publish creator profiles.");
    }
  }

  async function authenticateEvmProvider(provider: EthereumProvider, label: string) {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    if (!accounts[0]) throw new Error(`${label} did not return a wallet address.`);
    const address = getAddress(accounts[0]);
    await switchToBase(provider);
    const message = await requestSignIn(address, "evm");
    const signature = (await provider.request({ method: "personal_sign", params: [message, address] })) as string;
    await verifySignIn(address, "evm", message, signature, label);
    evmProviderRef.current = provider;
  }

  async function connectEvmWallet(kind: EvmWalletKind = "browser") {
    setWalletError("");
    const provider = injectedEvmProvider(kind);
    const label = kind === "binance" ? "Binance Wallet" : kind === "trust" ? "Trust Wallet" : "Base wallet";
    if (!provider) {
      setWalletError(`${label} was not detected. Install its browser extension or choose WalletConnect for a mobile wallet.`);
      return;
    }
    setWalletBusy(true);
    try {
      await authenticateEvmProvider(provider, label);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Wallet connection was cancelled.");
    } finally {
      setWalletBusy(false);
    }
  }

  async function connectWalletConnect() {
    setWalletError("");
    const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "bcf47f78b31ff3dba418e362303a181d";
    setWalletBusy(true);
    try {
      const { EthereumProvider: WalletConnectProvider } = await import("@walletconnect/ethereum-provider");
      const provider = await WalletConnectProvider.init({
        projectId,
        metadata: {
          name: "Crypto Sugar Babes",
          description: "Private, adults-only crypto-native social discovery",
          url: window.location.origin,
          icons: [`${window.location.origin}/icon.png`]
        },
        showQrModal: true,
        optionalChains: [8453],
        rpcMap: { 8453: "https://mainnet.base.org" }
      });
      await provider.connect();
      await authenticateEvmProvider(provider as EthereumProvider, "WalletConnect");
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "WalletConnect was cancelled.");
    } finally {
      setWalletBusy(false);
    }
  }

  async function connectSolanaWallet(kind: "solflare" | "phantom") {
    setWalletError("");
    const provider = kind === "solflare"
      ? window.solflare || (window.solana?.isSolflare ? window.solana : undefined)
      : window.phantom?.solana || (window.solana?.isPhantom ? window.solana : undefined);
    const label = kind === "solflare" ? "Solflare" : "Phantom";
    if (!provider) {
      setWalletError(`${label} was not detected. Install the ${label} browser extension, then refresh this page.`);
      return;
    }
    setWalletBusy(true);
    try {
      const connected = await provider.connect();
      const address = (connected.publicKey || provider.publicKey)?.toString();
      if (!address) throw new Error(`${label} did not return a wallet address.`);
      const message = await requestSignIn(address, "solana");
      const signed = await provider.signMessage(new TextEncoder().encode(message), "utf8");
      const signatureBytes = signed instanceof Uint8Array ? signed : signed.signature;
      await verifySignIn(address, "solana", message, bytesToBase64(signatureBytes), label);
      solanaProviderRef.current = provider;
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Wallet connection was cancelled.");
    } finally {
      setWalletBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setEmail(null);
    setWallet(null);
    setWalletChain(null);
    setWalletName("");
    setAccountType(null);
    setHasCreatorProfile(false);
    setUnreadCount(0);
    setUnseenPaymentCount(0);
    profileIntentRef.current = false;
    setFavorites(new Set());
    setConversations([]);
    evmProviderRef.current = null;
    solanaProviderRef.current = null;
    await loadPersistedProfiles();
    setNotice("Signed out of Crypto Sugar.");
  }

  async function toggleFavorite(profile: Profile) {
    if (profile.sample) {
      setNotice("Editorial samples cannot be saved. Try this with a published creator profile.");
      return;
    }
    if (!isAuthenticated) {
      setWalletError("Sign in with email to save favorites.");
      showEmailSignIn();
      return;
    }
    if (!accountType) { setAccountOpen(true); return; }
    const response = await fetch("/api/favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId: profile.id }) });
    const data = await response.json() as { favorited?: boolean; error?: string };
    if (!response.ok) { setWalletError(data.error || "That favorite could not be saved."); return; }
    setFavorites((current) => {
      const next = new Set(current);
      if (data.favorited) next.add(profile.id); else next.delete(profile.id);
      return next;
    });
    setNotice(data.favorited ? `${profile.name} was saved to your favorites.` : `${profile.name} was removed from favorites.`);
  }

  function openProfileCreator() {
    setWalletError("");
    profileIntentRef.current = true;
    if (!isAuthenticated) {
      setNotice("Sign in with email before creating a profile. You can connect a payout wallet later.");
      showEmailSignIn();
      return;
    }
    if (!accountType) {
      setAccountOpen(true);
      return;
    }
    if (accountType === "CUSTOMER") {
      profileIntentRef.current = false;
      setNotice("Sugar Daddy accounts stay private and cannot publish creator profiles.");
      return;
    }
    profileIntentRef.current = false;
    setProfileOpen(true);
  }

  async function saveAccount(type: AccountType) {
    if (!isAuthenticated) { showEmailSignIn(); return; }
    if (!acceptanceReady) { setWalletError("Confirm that you are 18+ and accept the Terms and Privacy Policy."); return; }
    setAccountSaving(true); setWalletError("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, displayName: accountDisplayName, bio: accountBio, acceptedAdult, acceptedTerms, acceptedPrivacy }) });
      const data = await response.json() as { account?: { type: AccountType }; error?: string };
      if (!response.ok) throw new Error(data.error || "Your account could not be saved.");
      setAccountType(type);
      setAcceptanceComplete(true);
      setAccountOpen(false);
      profileIntentRef.current = false;
      setNotice(type === "CREATOR" ? "Creator account ready. Build your profile now and connect Solana when you want to earn." : "Private Sugar Daddy account ready.");
      if (type === "CREATOR") setProfileOpen(true);
    } catch (error) { setWalletError(error instanceof Error ? error.message : "Your account could not be saved."); }
    finally { setAccountSaving(false); }
  }

  function handlePhotos(fileList?: FileList | null) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (profilePhotos.length + files.length > 8) {
      setWalletError("You can add up to 8 photos to a profile.");
      return;
    }
    if (files.some((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
      setWalletError("Choose JPG, PNG, or WebP images smaller than 5 MB each.");
      return;
    }
    setWalletError("");
    Promise.all(files.map((file) => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    }))).then((photos) => {
      setProfileFiles((current) => [...current, ...files]);
      setProfilePhotos((current) => [...current, ...photos]);
    });
  }

  function engagementFor(profile: Profile) {
    const extra = engagement[profile.id] || { messages: 0, likes: 0, giftsUsdc: 0 };
    const likes = (profile.photoLikes || 0) + extra.likes;
    const giftsUsdc = (profile.giftsUsdc || 0) + extra.giftsUsdc;
    const points = creatorSupportPoints(likes, giftsUsdc);
    return {
      points,
      likes,
      likePrice: photoLikePriceUsdc(likes),
      giftsUsdc,
      messages: extra.messages,
      progress: likes % 100
    };
  }

  function openMessage(profile: Profile) {
    if (!isAuthenticated) {
      setWalletError("Sign in with email to start a free conversation.");
      showEmailSignIn();
      return;
    }
    if (profile.sample) { setNotice("Editorial samples cannot receive messages. Try a published creator profile."); return; }
    if (!accountType) { setAccountOpen(true); return; }
    if (accountType !== "CUSTOMER") { setNotice("Creator accounts reply from their inbox; they cannot initiate customer conversations."); return; }
    setMessageText("");
    setMessageBoostAmount("");
    setMessageTarget(profile);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitNewMessage();
  }

  async function submitNewMessage(options: { acknowledgeUnansweredWarning?: boolean; usePaidUnlock?: boolean } = {}) {
    if (!messageTarget || !messageText.trim()) return;
    const boostAmount = Number(messageBoostAmount || 0);
    if (!Number.isFinite(boostAmount) || boostAmount < 0 || boostAmount > 100_000) {
      setWalletError("Choose a valid optional boost amount.");
      return;
    }
    if (boostAmount > 0 && !messageTarget.supportEnabled) {
      setWalletError(`${messageTarget.name} has not connected a payout wallet yet. Send the message free without a boost.`);
      return;
    }
    if (boostAmount > 0 && !wallet) {
      setWalletError("Connect a wallet to add a paid message boost. Sending without a boost remains free.");
      showWalletPicker();
      return;
    }
    setMessageBusy(true); setWalletError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId: messageTarget.id, body: messageText, ...options }) });
      const data = await response.json() as MessageGate & { id?: string; conversationId?: string; messageNotice?: string };
      if (!response.ok) {
        if (data.code === "UNANSWERED_WARNING" || data.code === "REPLY_REQUIRED") { setMessageGate(data); return; }
        throw new Error(data.error || "Your message could not be sent.");
      }
      const target = messageTarget;
      setMessageTarget(null); setMessageText(""); setMessageGate(null);
      await loadMessages(false);
      if (boostAmount > 0 && data.id) await settlePayment(target, "MESSAGE_BOOST", String(boostAmount), { messageId: data.id });
      else setNotice(data.messageNotice || `Your message to ${target.name} was delivered.`);
    } catch (error) { setWalletError(error instanceof Error ? error.message : "Your message could not be sent."); }
    finally { setMessageBusy(false); setMessageBoostAmount(""); }
  }

  async function paymentQuote(profile: Profile, kind: PaymentKind, amountUsdc?: string, link?: { mediaId?: string; messageId?: string; conversationId?: string }) {
    const response = await fetch("/api/payments/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId: profile.id, kind, amountUsdc, ...link }) });
    const data = await response.json() as PaymentQuote & { error?: string };
    if (!response.ok) throw new Error(data.error || "A secure payment quote could not be created.");
    return data;
  }

  async function confirmPayment(quote: PaymentQuote, transactionHashes: string[]) {
    const response = await fetch("/api/payments/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteId: quote.quoteId, transactionHashes }) });
    const data = await response.json() as { confirmed?: boolean; error?: string };
    if (!response.ok || !data.confirmed) throw new Error(data.error || "The payment could not be confirmed on-chain.");
  }

  async function settleBasePayment(quote: PaymentQuote) {
    const provider = evmProviderRef.current || injectedEvmProvider("browser");
    if (!provider || !wallet) throw new Error("Reconnect your Base wallet so it can approve the USDC transfers.");
    await switchToBase(provider);
    const accounts = await provider.request({ method: "eth_accounts" }) as string[];
    if (!accounts[0] || getAddress(accounts[0]) !== getAddress(wallet)) throw new Error("The active Base wallet does not match your signed-in account.");
    const walletClient = createWalletClient({ account: getAddress(wallet), chain: base, transport: custom(provider) });
    const publicClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
    const token = getAddress(quote.tokenAddress);
    const owner = getAddress(wallet);
    if (quote.kind === "MESSAGE_UNLOCK") {
      if (Date.now() >= new Date(quote.expiresAt).getTime()) throw new Error("That payment quote expired. Start again to receive a current price.");
      const hash = await walletClient.writeContract({ account: owner, chain: base, address: token, abi: erc20Abi, functionName: "transfer", args: [getAddress(quote.treasuryAddress), BigInt(quote.grossMicros)] });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt.status !== "success") throw new Error("The Base USDC message-unlock payment reverted.");
      await confirmPayment(quote, [hash]);
      return;
    }
    if (!quote.splitterAddress) {
      throw new Error("Base payments are temporarily unavailable while atomic 90/10 settlement is being completed.");
    }
    if (Date.now() >= new Date(quote.expiresAt).getTime()) throw new Error("That payment quote expired. Start again to receive a current price.");
    const splitter = getAddress(quote.splitterAddress);
    const allowance = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, splitter] });
    if (allowance < BigInt(quote.grossMicros)) {
      const approvalHash = await walletClient.writeContract({ account: owner, chain: base, address: token, abi: erc20Abi, functionName: "approve", args: [splitter, BigInt(quote.grossMicros)] });
      const approval = await publicClient.waitForTransactionReceipt({ hash: approvalHash, confirmations: 1 });
      if (approval.status !== "success") throw new Error("The Base USDC approval reverted.");
    }
    if (Date.now() >= new Date(quote.expiresAt).getTime()) throw new Error("The quote expired during approval. Start again; the approval did not move any USDC.");
    const splitterAbi = [{ type: "function", name: "payAndSplit", stateMutability: "nonpayable", inputs: [{ name: "quoteId", type: "bytes32" }, { name: "creator", type: "address" }, { name: "grossAmount", type: "uint256" }], outputs: [] }] as const;
    const args = [keccak256(stringToHex(quote.quoteId)), getAddress(quote.creatorAddress), BigInt(quote.grossMicros)] as const;
    await publicClient.simulateContract({ account: owner, address: splitter, abi: splitterAbi, functionName: "payAndSplit", args });
    const hash = await walletClient.writeContract({ account: owner, chain: base, address: splitter, abi: splitterAbi, functionName: "payAndSplit", args });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error("The atomic Base USDC payment reverted.");
    await confirmPayment(quote, [hash]);
  }

  async function settleSolanaPayment(quote: PaymentQuote) {
    const provider = solanaProviderRef.current || window.solflare || window.phantom?.solana || window.solana;
    if (!provider?.signAndSendTransaction || !wallet) throw new Error("Reconnect Solflare or Phantom so it can approve the USDC transaction.");
    const connected = await provider.connect();
    const activeAddress = (connected.publicKey || provider.publicKey)?.toString();
    if (!activeAddress) throw new Error("Your Solana wallet did not return an active account. Reconnect it and try again.");
    if (activeAddress !== wallet) throw new Error("The active Solana wallet does not match your signed-in account. Reconnect the correct wallet and try again.");
    solanaProviderRef.current = provider;
    if (Date.now() >= new Date(quote.expiresAt).getTime()) throw new Error("That payment quote expired. Start again to receive a current price.");
    const [{ Connection, PublicKey, Transaction }, token] = await Promise.all([import("@solana/web3.js"), import("@solana/spl-token")]);
    const connection = new Connection(`${window.location.origin}/api/payments/solana-rpc`, "confirmed");
    const owner = new PublicKey(wallet);
    const mint = new PublicKey(quote.tokenAddress);
    const creator = new PublicKey(quote.creatorAddress);
    const treasury = new PublicKey(quote.treasuryAddress);
    const sourceAta = token.getAssociatedTokenAddressSync(mint, owner);
    const creatorAta = token.getAssociatedTokenAddressSync(mint, creator);
    const treasuryAta = token.getAssociatedTokenAddressSync(mint, treasury);
    if (!await connection.getAccountInfo(sourceAta)) throw new Error("This Solana wallet does not have a USDC token account.");
    const sourceBalance = await connection.getTokenAccountBalance(sourceAta, "confirmed");
    if (BigInt(sourceBalance.value.amount) < BigInt(quote.grossMicros)) {
      const requiredUsdc = Number(quote.grossAmountUsdc).toLocaleString(undefined, { maximumFractionDigits: 6 });
      throw new Error(`This wallet has ${sourceBalance.value.uiAmountString || "0"} USDC. This payment requires ${requiredUsdc} USDC.`);
    }
    const transaction = new Transaction();
    if (BigInt(quote.creatorMicros) > BigInt(0) && !await connection.getAccountInfo(creatorAta)) transaction.add(token.createAssociatedTokenAccountInstruction(owner, creatorAta, creator, mint));
    if (!await connection.getAccountInfo(treasuryAta)) transaction.add(token.createAssociatedTokenAccountInstruction(owner, treasuryAta, treasury, mint));
    if (BigInt(quote.creatorMicros) > BigInt(0)) transaction.add(token.createTransferCheckedInstruction(sourceAta, mint, creatorAta, owner, BigInt(quote.creatorMicros), 6));
    transaction.add(token.createTransferCheckedInstruction(sourceAta, mint, treasuryAta, owner, BigInt(quote.platformMicros), 6));
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = owner;
    transaction.recentBlockhash = latest.blockhash;
    const sent = await provider.signAndSendTransaction(transaction);
    const signature = typeof sent === "string" ? sent : sent.signature;
    const confirmationDeadline = Date.now() + 60_000;
    let confirmed = false;
    while (Date.now() < confirmationDeadline) {
      const statuses = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
      const status = statuses.value[0];
      if (status?.err) throw new Error("The Solana USDC transaction failed.");
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
        confirmed = true;
        break;
      }
      if (await connection.getBlockHeight("confirmed") > latest.lastValidBlockHeight) {
        throw new Error("The Solana transaction expired before confirmation. No payment was recorded.");
      }
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
    if (!confirmed) throw new Error("Solana is taking longer than expected to confirm the payment. Check your wallet activity before trying again.");
    await confirmPayment(quote, [signature]);
  }

  async function settlePayment(profile: Profile, kind: PaymentKind, amountUsdc?: string, link?: { mediaId?: string; messageId?: string }) {
    if (profile.sample) { setNotice("Editorial samples cannot receive real payments."); return; }
    if (!profile.supportEnabled) { setNotice("This creator has not connected a payout wallet yet. Gifts and paid likes are unavailable."); return; }
    if (!wallet) { setWalletError("Connect a matching wallet before paying."); showWalletPicker(); return; }
    if (!accountType) { setAccountOpen(true); return; }
    if (accountType !== "CUSTOMER") { setNotice("Only private customer accounts can send paid support."); return; }
    setPaymentBusy(true); setWalletError("");
    try {
      const quote = await paymentQuote(profile, kind, amountUsdc, link);
      setPaymentExpiresAt(quote.expiresAt);
      setPaymentClock(Date.now());
      setNotice("Secure payment quote created. Complete the wallet approval within 15 minutes.");
      if (quote.network === "BASE") await settleBasePayment(quote);
      else await settleSolanaPayment(quote);
      const amount = Number(quote.grossAmountUsdc);
      setSupportGivenUsdc((current) => current + amount);
      await Promise.all([loadPersistedProfiles(), loadAccount()]);
      setActiveProfile((current) => current?.id === profile.id ? {
        ...current,
        photoLikes: (current.photoLikes || 0) + (kind === "PAID_LIKE" ? 1 : 0),
        giftsUsdc: (current.giftsUsdc || 0) + (kind === "GIFT" || kind === "MESSAGE_BOOST" ? amount : 0),
        media: current.media?.map((item) => item.id === link?.mediaId ? { ...item, paidLikes: item.paidLikes + 1 } : item)
      } : current);
      setNotice(`${kind === "PAID_LIKE" ? "Paid like" : kind === "GIFT" ? "Gift" : "Message boost"} confirmed on-chain: ${formatUsdc(amount)} USDC split 90/10.`);
    } catch (error) {
      setWalletError(paymentErrorMessage(error));
    } finally { setPaymentBusy(false); setPaymentExpiresAt(null); }
  }

  async function purchaseMessageUnlock(conversationId: string) {
    if (!wallet) { setWalletError("Connect a Base or Solana wallet to unlock one paid message."); showWalletPicker(); return false; }
    if (!accountType) { setAccountOpen(true); return false; }
    setPaymentBusy(true); setWalletError("");
    try {
      const response = await fetch("/api/payments/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "MESSAGE_UNLOCK", conversationId }) });
      const quote = await response.json() as PaymentQuote & { error?: string };
      if (!response.ok) throw new Error(quote.error || "A secure message-unlock quote could not be created.");
      setPaymentExpiresAt(quote.expiresAt); setPaymentClock(Date.now());
      setNotice("Approve the 10 USDC weekly message unlock in your wallet.");
      if (quote.network === "BASE") await settleBasePayment(quote); else await settleSolanaPayment(quote);
      await loadMessages(false);
      setNotice("Your weekly paid-message unlock is confirmed. One additional message can now be sent.");
      return true;
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "The paid-message unlock was not completed.");
      return false;
    } finally { setPaymentBusy(false); setPaymentExpiresAt(null); }
  }

  async function likeFeaturedPhoto(profile: Profile, requestedMediaId?: string) {
    if (!profile.supportEnabled) { setNotice("This creator has not connected a payout wallet yet. Paid likes are unavailable."); return; }
    const mediaId = requestedMediaId || profile.media?.[0]?.id;
    if (!mediaId) { setNotice("This profile does not have a published photograph available for paid likes."); return; }
    await settlePayment(profile, "PAID_LIKE", undefined, { mediaId });
  }

  function openGift(profile: Profile) {
    if (!profile.supportEnabled) {
      setNotice("This creator has not connected a payout wallet yet. Gifts are unavailable.");
      return;
    }
    if (!wallet) {
      setWalletError("Connect a wallet before sending a gift.");
      showWalletPicker();
      return;
    }
    setGiftAmount("25");
    setGiftTarget(profile);
  }

  async function sendGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!giftTarget) return;
    const amount = Number(giftAmount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100_000) {
      setWalletError("Enter a gift between 1 and 100,000 USDC.");
      return;
    }
    const target = giftTarget;
    setGiftTarget(null);
    await settlePayment(target, "GIFT", String(amount));
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWalletError("");
    if (!isAuthenticated) {
      setWalletError("Sign in with email before saving your profile.");
      profileIntentRef.current = true;
      showEmailSignIn();
      return;
    }
    const age = Number(profileForm.age);
    if (!Number.isInteger(age) || age < 18) {
      setWalletError("Crypto Sugar is strictly for adults aged 18 and over.");
      return;
    }
    setProfileSaving(true);
    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...profileForm,
          age,
          interests: profileForm.interests.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 5)
        })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Your profile could not be saved.");

      for (let index = 0; index < profileFiles.length; index += 1) {
        const form = new FormData();
        form.append("photo", profileFiles[index]);
        const photoResponse = await fetch("/api/profile/photos", { method: "POST", body: form });
        const photoData = await photoResponse.json() as { error?: string };
        if (!photoResponse.ok) throw new Error(`Profile saved, but photo ${index + 1} failed: ${photoData.error || "upload error"}`);
      }

      await loadPersistedProfiles();
      setAccountType("CREATOR");
      setHasCreatorProfile(true);
      setProfileForm(emptyProfile);
      setProfilePhotos([]);
      setProfileFiles([]);
      setProfileOpen(false);
      setRegion("Anywhere");
      setQuery("");
      window.setTimeout(() => document.querySelector("#discover")?.scrollIntoView({ behavior: "smooth" }), 80);
      setNotice("Your profile and photos are now published. You can manage them from your dashboard.");
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Your profile could not be saved.");
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <main>
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>

      <header className="site-header">
        <div className="brand-social"><a className="brand" href="/" aria-label="Crypto Sugar Babes home"><img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a><InstagramLink/><XLink/></div>
        <nav aria-label="Main navigation"><a href="/how-it-works">How it works</a><a href="/crypto-safety">Crypto safety</a><a href="/forums">Forums</a></nav>
        <div className="header-actions">
          {!hasCreatorProfile && accountType !== "CUSTOMER" && <button className="text-button" onClick={openProfileCreator}>Create profile</button>}
          {isAuthenticated && <a className={`text-button dashboard-link ${unseenPaymentCount > 0 ? "has-notifications" : ""}`} href={unseenPaymentCount > 0 ? "/dashboard#activity" : "/dashboard"}>Dashboard{unseenPaymentCount > 0 && <span className="unread-badge">{unseenPaymentCount > 99 ? "99+" : unseenPaymentCount}</span>}</a>}
          {isAuthenticated && accountType && <button className="text-button inbox-button" onClick={openInbox}>Inbox{unreadCount > 0 && <span className="unread-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>}
          {isAuthenticated && !accountType && <button className="text-button" onClick={() => setAccountOpen(true)}>Choose account</button>}
          {email && !wallet && <button className="text-button" onClick={() => { setWalletError(""); showWalletPicker(); }}>Connect wallet</button>}
          {isAuthenticated ? <button className="wallet-button connected" onClick={signOut} title="Click to sign out"><span className="online-dot"/>{wallet ? `${accountType === "CREATOR" ? "Creator" : accountType === "CUSTOMER" ? "Customer" : walletName || (walletChain === "solana" ? "Solana" : "Base")} · ${shortAddress(wallet)}` : email}</button>
            : <button className="wallet-button" onClick={showEmailSignIn}><Icon name="user" size={17}/>Sign in</button>}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy-block">
          <div className="eyebrow"><span/> PRIVATE. MAGNETIC. CRYPTO-NATIVE. <span/></div>
          <h1>Crypto is the<br/>ultimate <em>sugar.</em></h1>
          <p className="hero-copy">Chat for free. Give sugar in crypto.</p>
          <div className="hero-actions"><button className="primary-button" onClick={openProfileCreator}>Be a Sugar Babe <Icon name="arrow" size={18}/></button>{!hasCreatorProfile && accountType !== "CUSTOMER" && <button className="secondary-button" onClick={openProfileCreator}>Be a Sugar Daddy</button>}</div>
          <div className="trust-row"><span><Icon name="shield" size={17}/>Adults only</span><span><Icon name="lock" size={17}/>Wallet optional</span><span><Icon name="globe" size={17}/>Global access</span></div>
        </div>
      </section>

      <section className="desire-strip" aria-label="Platform values"><span>{basePaymentsLive ? "Discreet. Safe. Monitored. Base & Solana USDC payments." : "Discreet. Safe. Monitored. Base wallet access · Solana USDC payments."}</span></section>

      <section className="discovery-section" id="discover">
        <div className="section-heading"><div><h2>Connect. Indulge. Grow. Crypto.</h2></div><p>We manage all profiles and disputes with care.</p></div>
        <div className="filter-bar">
          <label className="search-field"><Icon name="search" size={19}/><input aria-label="Search creator interests or destinations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search interests or destinations"/></label>
          <div className={`select-field custom-region-select ${regionMenuOpen ? "open" : ""}`} ref={regionMenuRef}>
            <span>REGION</span>
            <button
              className="region-select-trigger"
              type="button"
              aria-label="Filter creators by region"
              aria-haspopup="listbox"
              aria-expanded={regionMenuOpen}
              aria-controls="region-filter-options"
              onClick={() => setRegionMenuOpen((open) => !open)}
            >
              <strong>{region}</strong>
              <i aria-hidden="true">⌄</i>
            </button>
            {regionMenuOpen && <div className="region-select-menu" id="region-filter-options" role="listbox" aria-label="Regions">
              {["Anywhere", ...REGIONS].map((item) => <button
                className={item === region ? "selected" : ""}
                type="button"
                role="option"
                aria-selected={item === region}
                key={item}
                onClick={() => { setRegion(item); setRegionMenuOpen(false); }}
              >
                {item}
                {item === region && <Icon name="check" size={17}/>}
              </button>)}
            </div>}
          </div>
        </div>
        <div className="profile-grid">
          {filteredProfiles.map((profile) => <article className="profile-card" key={profile.id}>
            <button className={`favorite-button ${favorites.has(profile.id) ? "active" : ""}`} onClick={() => toggleFavorite(profile)} aria-label={`${favorites.has(profile.id) ? "Remove" : "Add"} ${profile.name} ${favorites.has(profile.id) ? "from" : "to"} favorites`}><Icon name="heart" size={18} filled={favorites.has(profile.id)}/></button>
            <button className="profile-open" onClick={() => { trackProductEvent("PROFILE_VIEWED"); setActiveProfile(profile); setSelectedMediaId(profile.media?.[0]?.id || ""); }} aria-label={`View ${profile.name}'s profile`}>
              <ProfileArtwork profile={profile}/>
              <div className="profile-content"><div className="profile-name-row"><h3>{profile.name}, {profile.age}</h3>{profile.sample ? <span className="sample-badge">SAMPLE</span> : profile.verified ? <span className="verified-badge" title="Published creator"><Icon name="check" size={12}/></span> : <span className="draft-badge">{profile.reviewStatus === "PENDING_REVIEW" ? "IN REVIEW" : profile.reviewStatus === "REJECTED" ? "CHANGES NEEDED" : "DRAFT"}</span>}</div><p className="location">{profile.country} · {profile.region}</p><p className="headline">{profile.headline}</p><div className="tag-row">{profile.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
            </button>
          </article>)}
        </div>
        {filteredProfiles.length === 0 && <div className="empty-state">No profiles match those filters yet.</div>}
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-heading compact"><div><span className="section-kicker">DESIRE, WITH STANDARDS</span><h2>Private by design. Free to join.</h2></div></div>
        <div className="steps-grid">
          <div className="step-card"><span className="step-number">01</span><Icon name="mail" size={26}/><h3>Join with email</h3><p>Sign in with a private one-time code. No password or wallet is required to create a profile or message.</p></div>
          <div className="step-card"><span className="step-number">02</span><Icon name="user" size={26}/><h3>Submit your profile</h3><p>Introduce yourself, add your style and interests, then submit. Profiles and photos are reviewed regularly by administrators.</p></div>
          <div className="step-card"><span className="step-number">03</span><Icon name="message" size={26}/><h3>Sugar with Crypto</h3><p>Send likes for crypto, send gifts in crypto, raise your profiles as a Sugar Daddy when you give and a Sugar Babe when you receive.</p></div>
        </div>
      </section>

      <section className="crypto-section">
        <div className="crypto-copy"><span className="section-kicker">Recognition in USDC</span><h2>Likes. Gifts. Respect.</h2><p>{basePaymentsLive ? "Creators can join by email, submit a profile with up to eight photos free, and message for free. Connect Base or Solana to send or receive paid likes, gifts, and boosts." : "Creators can join by email, submit a profile with up to eight photos free, and message for free. Connect Solana to send or receive paid likes, gifts, and boosts. Base wallets currently support sign-in and free messaging while atomic Base settlement is activated."}</p><ul><li><Icon name="check" size={16}/>{basePaymentsLive ? "Base wallets: live Base USDC payments" : "Base wallets: sign-in and free messaging"}</li><li><Icon name="check" size={16}/>Solflare and Phantom: live Solana USDC payments</li><li><Icon name="check" size={16}/>Profiles and messages work without a wallet</li><li><Icon name="check" size={16}/>{basePaymentsLive ? "Atomic 90/10 creator and platform settlement" : "Base USDC payments unlock after splitter activation"}</li></ul></div>
        <div className="access-card"><div className="access-orbit"><Icon name="spark" size={28}/></div><span>FREE MEMBERSHIP</span><h3>Make an entrance.</h3><p>Create and preview your profile, then submit when you are ready. Profiles and photos are reviewed regularly.</p><div className="access-networks"><button type="button" onClick={() => { setWalletError(""); showWalletPicker("general", "evm"); }}><i className="base-symbol">B</i><span>{basePaymentsLive ? "Base payments" : "Base sign-in"}</span><Icon name="arrow" size={15}/></button><button type="button" onClick={() => { setWalletError(""); showWalletPicker("general", "solana"); }}><i className="solana-symbol">S</i><span>Solana payments</span><Icon name="arrow" size={15}/></button></div>{hasCreatorProfile || accountType === "CUSTOMER" ? <a className="primary-button full" href="/dashboard">{hasCreatorProfile ? "Manage your profile" : "Open your dashboard"} <Icon name="arrow" size={18}/></a> : <button className="primary-button full" onClick={openProfileCreator}>Create your profile <Icon name="arrow" size={18}/></button>}<small>No profile fees. No boost charges. No recovery phrase—ever.</small></div>
      </section>

      <section className="wallet-setup-section" id="wallet-security" aria-labelledby="wallet-setup-title">
        <div className="wallet-setup-heading">
          <h2 id="wallet-setup-title">Safe and Secure</h2>
          <p>Set up a secure wallet.</p>
        </div>
        <div className="wallet-setup-carousel" aria-label="Official wallet setup links">
          <div className="wallet-setup-track">
            {[false, true].map((duplicate) => (
              <div className="wallet-setup-group" aria-hidden={duplicate ? true : undefined} key={duplicate ? "wallets-copy" : "wallets-primary"}>
                {walletSetupLinks.map((wallet) => (
                  <a className="wallet-setup-card" href={wallet.href} target="_blank" rel="noopener noreferrer" tabIndex={duplicate ? -1 : undefined} key={`${wallet.name}-${duplicate ? "copy" : "primary"}`}>
                    <span className={`wallet-brand-mark wallet-brand-${wallet.tone}`} aria-hidden="true">{wallet.mark}</span>
                    <span className="wallet-card-copy"><strong>{wallet.name}</strong><small>{wallet.network}</small></span>
                    <Icon name="arrow" size={17}/>
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="safety-section" id="safety"><div className="safety-mark"><Icon name="shield" size={31}/></div><div className="safety-copy"><span className="section-kicker">SAFETY IS THE PRODUCT</span><h2>Adults only. Respect always.</h2><a href="mailto:email@cryptosugarbabes.com?subject=Safety%20report">Contact safety <Icon name="arrow" size={17}/></a></div><p>Crypto Sugar is designed for lawful social discovery and companionship. Coercion, trafficking, underage users, non-consensual content, extortion, and unlawful activity are prohibited and subject to removal.</p></section>

      <footer><div className="brand-social"><a className="brand" href="#top"><img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a><InstagramLink/><XLink/></div><p className="footer-copyright">© 2026 Crypto Sugar Babes. Safety First Always.</p><div className="footer-links"><a href="/disputes">Disputes</a><a href="/safety">Safety</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div></footer>

      {activeProfile && (() => {
        const stats = engagementFor(activeProfile);
        const selectedMedia = activeProfile.media?.find((item) => item.id === selectedMediaId) || activeProfile.media?.[0];
        const displayedProfile = selectedMedia ? { ...activeProfile, imageUrl: selectedMedia.url, imagePosition: { x: selectedMedia.focalX ?? 50, y: selectedMedia.focalY ?? 50 } } : activeProfile;
        return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveProfile(null); }}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <button className="modal-close" onClick={() => setActiveProfile(null)} aria-label="Close profile"><Icon name="close" size={20}/></button>
            <div className="profile-media-column">
              <ProfileArtwork profile={displayedProfile} large/>
              {Boolean(activeProfile.media?.length && activeProfile.media.length > 1) && <div className="profile-photo-thumbnails">{activeProfile.media?.map((item, index) => <button className={item.id === selectedMedia?.id ? "active" : ""} onClick={() => setSelectedMediaId(item.id)} key={item.id}><img src={item.url} alt={`${activeProfile.name} photo ${index + 1}`} style={{ objectPosition: `${item.focalX ?? 50}% ${item.focalY ?? 50}%` }}/><span>{item.paidLikes} likes</span></button>)}</div>}
              <button className="photo-like-button" disabled={paymentBusy || !selectedMedia || !activeProfile.supportEnabled} onClick={() => likeFeaturedPhoto(activeProfile, selectedMedia?.id)}><Icon name="heart" size={17}/><span>{paymentBusy ? "Confirming…" : activeProfile.supportEnabled ? "Send this photo a paid like" : "This user needs a wallet first"}</span>{activeProfile.supportEnabled && <strong>{formatUsdc(stats.likePrice)} USDC</strong>}</button>
            </div>
            <div className="modal-content">
              <span className="verified-line"><Icon name="shield" size={15}/>{activeProfile.sample ? "Editorial sample · Not a real member" : activeProfile.verified ? "Published profile · Adult self-attested" : "Private or hidden profile"}</span>
              <h2 id="profile-modal-title">{activeProfile.name}, {activeProfile.age}</h2><p className="location">{activeProfile.country} · {activeProfile.region}</p>
              <h3>{activeProfile.headline}</h3><p className="modal-bio">{activeProfile.bio}</p>
              <div className="creator-stats"><div><span>SUPPORT SCORE</span><strong>{stats.points} pts</strong></div><div><span>PAID LIKES</span><strong>{stats.likes.toLocaleString()}</strong></div><div><span>NEXT LIKE</span><strong>{formatUsdc(stats.likePrice)} USDC</strong></div></div>
              <div className="rating-progress"><span style={{ width: `${stats.progress}%` }}/></div><p className="rating-note">{100 - stats.progress} more paid likes until the next 0.1% like-value increase.</p>
              <div className="tag-row large">{activeProfile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              {wallet && supportGivenUsdc > 0 && <div className="generosity-badge"><Icon name="spark" size={15}/><span>Your generosity</span><strong>{generosityLevel(generosityPoints(supportGivenUsdc))} · {generosityPoints(supportGivenUsdc)} pts</strong></div>}
              <div className="modal-actions"><button className="primary-button message-send-button" onClick={() => openMessage(activeProfile)}><Icon name="message" size={18}/>Send message</button><span className="profile-action-tooltip gift-tooltip" data-tooltip={activeProfile.supportEnabled ? "Send a USDC gift" : "This user needs a wallet first"} tabIndex={!activeProfile.supportEnabled ? 0 : undefined}><button className="gift-action" disabled={paymentBusy || !activeProfile.supportEnabled} onClick={() => openGift(activeProfile)} aria-label={activeProfile.supportEnabled ? "Send a USDC gift" : "Gift unavailable: this user needs a wallet first"}><Icon name="spark" size={16}/>Gift</button></span><span className="profile-action-tooltip heart-tooltip" data-tooltip={favorites.has(activeProfile.id) ? "Remove from Your Favorites" : "Add to Your Favorites"}><button className={`heart-action ${favorites.has(activeProfile.id) ? "active" : ""}`} onClick={() => toggleFavorite(activeProfile)} aria-label={favorites.has(activeProfile.id) ? "Remove from Your Favorites" : "Add to Your Favorites"}><Icon name="heart" size={19} filled={favorites.has(activeProfile.id)}/></button></span></div>
              {!activeProfile.sample && !activeProfile.isOwn && <button className="report-link" onClick={() => openReport({ profileId: activeProfile.id, label: `${activeProfile.name}'s profile` })}>Report this profile</button>}
              <p className="modal-footnote">Messages are delivered free. {activeProfile.supportEnabled ? "Paid likes, gifts, and boosts use USDC and are split 90% to the creator and 10% to the platform after on-chain confirmation." : "Paid support becomes available after the creator connects Solana, or when atomic Base settlement is enabled."}</p>
            </div>
          </section>
        </div>;
      })()}

      {messageTarget && (() => {
        const stats = engagementFor(messageTarget);
        return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMessageTarget(null); }}>
          <section className="message-modal" role="dialog" aria-modal="true" aria-labelledby="message-title">
            <button className="modal-close" onClick={() => setMessageTarget(null)} aria-label="Close message"><Icon name="close" size={20}/></button>
            <span className="section-kicker">PRIVATE INTRODUCTION</span><h2 id="message-title">Message {messageTarget.name}.</h2>
            <p className="wallet-intro">Every normal message is free. You may optionally attach a boost so your introduction is highlighted and your generosity reputation grows.</p>
            <form onSubmit={sendMessage}><label className="message-field"><span>YOUR MESSAGE</span><textarea required maxLength={800} autoFocus value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Start with something thoughtful…"/><small>{messageText.length}/800</small></label>
              <div className="boost-panel"><div><span>OPTIONAL MESSAGE BOOST</span><small>{messageTarget.supportEnabled ? "Boosted introductions receive priority placement." : "This creator has not enabled USDC earnings yet. Your message remains free."}</small></div><div className="preset-buttons"><button type="button" className={!messageBoostAmount ? "active" : ""} onClick={() => setMessageBoostAmount("")}>Free</button>{messageTarget.supportEnabled && [5, 10, 25].map((amount) => <button type="button" className={messageBoostAmount === String(amount) ? "active" : ""} onClick={() => setMessageBoostAmount(String(amount))} key={amount}>{amount} USDC</button>)}</div>{messageTarget.supportEnabled && <label><span>Custom boost</span><input type="number" min="0" max="100000" step="0.01" value={messageBoostAmount} onChange={(event) => setMessageBoostAmount(event.target.value)} placeholder="0.00"/></label>}</div>
              <div className="message-checkout"><div><span>Normal message</span><strong>Free</strong></div><div><span>Creator support score</span><strong>{stats.points} points</strong></div><div className="message-total"><span>{messageBoostAmount ? "Optional boost" : "Amount due"}</span><strong>{messageBoostAmount ? `${formatUsdc(Number(messageBoostAmount) || 0)} USDC` : "Free"}</strong></div></div>
              {messageGate && <aside className="message-limit-notice"><strong>Crypto Sugar reminder</strong><p>{messageGate.error}</p>{messageGate.code === "UNANSWERED_WARNING" && <button type="button" disabled={messageBusy} onClick={() => submitNewMessage({ acknowledgeUnansweredWarning: true })}>Send third message</button>}{messageGate.hasPaidUnlock && <button type="button" disabled={messageBusy} onClick={() => submitNewMessage({ usePaidUnlock: true })}>Send with paid unlock</button>}{messageGate.canPurchaseUnlock && <button type="button" disabled={paymentBusy} onClick={async () => { if (await purchaseMessageUnlock(messageGate.conversationId)) await submitNewMessage({ usePaidUnlock: true }); }}>{paymentBusy ? "Confirming…" : "Unlock & send · 10 USDC"}</button>}{messageGate.nextUnlockAt && !messageGate.hasPaidUnlock && !messageGate.canPurchaseUnlock && <small>Next paid unlock: {new Date(messageGate.nextUnlockAt).toLocaleString()}</small>}</aside>}
              <button className="primary-button full message-send-button" type="submit" disabled={messageBusy || paymentBusy || Boolean(messageGate)}>{messageBusy || paymentBusy ? "Sending…" : messageBoostAmount ? `Send & boost · ${formatUsdc(Number(messageBoostAmount) || 0)} USDC` : "Send message"} <Icon name="arrow" size={18}/></button><p className="checkout-note"><Icon name="lock" size={13}/>The message is delivered first. Any optional boost then requires wallet approval and on-chain confirmation.</p>
            </form>
          </section>
        </div>;
      })()}

      {giftTarget && (() => {
        const amount = Number(giftAmount) || 0;
        return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGiftTarget(null); }}>
          <section className="message-modal gift-modal" role="dialog" aria-modal="true" aria-labelledby="gift-title">
            <button className="modal-close" onClick={() => setGiftTarget(null)} aria-label="Close gift"><Icon name="close" size={20}/></button>
            <span className="section-kicker">A GENEROUS GESTURE</span><h2 id="gift-title">Gift {giftTarget.name}.</h2>
            <p className="wallet-intro">Choose any amount. Gifts increase {giftTarget.name}&apos;s support score and build your public generosity reputation as a supporter.</p>
            <form onSubmit={sendGift}><div className="preset-buttons gift-presets">{[5, 25, 50, 100].map((preset) => <button type="button" className={giftAmount === String(preset) ? "active" : ""} onClick={() => setGiftAmount(String(preset))} key={preset}>{preset} USDC</button>)}</div><label className="gift-amount"><span>CUSTOM GIFT</span><input type="number" min="1" max="100000" step="0.01" required value={giftAmount} onChange={(event) => setGiftAmount(event.target.value)} placeholder="25.00"/></label>
              <div className="message-checkout"><div><span>Creator receives 90%</span><strong>{formatUsdc(creatorShareUsdc(amount))} USDC</strong></div><div><span>Platform receives 10%</span><strong>{formatUsdc(platformShareUsdc(amount))} USDC</strong></div><div className="message-total"><span>Your generosity after gift</span><strong>{generosityLevel(generosityPoints(supportGivenUsdc + amount))}</strong></div></div>
              <button className="primary-button full" type="submit" disabled={paymentBusy}>{paymentBusy ? "Confirming on-chain…" : `Send gift · ${formatUsdc(amount)} USDC`} <Icon name="arrow" size={18}/></button><p className="checkout-note"><Icon name="lock" size={13}/>Your wallet shows the exact USDC transfer before approval. Settlement is recorded only after on-chain verification.</p>
            </form>
          </section>
        </div>;
      })()}

      {accountOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !accountSaving) setAccountOpen(false); }}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><button className="modal-close" onClick={() => setAccountOpen(false)} aria-label="Close account choice"><Icon name="close" size={20}/></button>{accountType && <span className="section-kicker">MEMBERSHIP CONFIRMATION</span>}<h2 id="account-title">{accountType ? "Confirm your membership." : "How will you use Crypto Sugar?"}</h2><p className="wallet-intro">Both account types can begin with email and message for free. Wallets are only required for sending or receiving paid support.</p>{!accountType && <div className="account-role-grid"><article><Icon name="spark" size={24}/><h3>Sugar Babe</h3><button className="primary-button full" disabled={accountSaving || !acceptanceReady} onClick={() => saveAccount("CREATOR")}>Ok I&apos;m a Babe!</button></article><article><Icon name="user" size={24}/><h3>Sugar Daddy</h3><button className="primary-button full" disabled={accountSaving || !acceptanceReady} onClick={() => saveAccount("CUSTOMER")}>Ok, I&apos;m a Daddy.</button></article></div>}<div className="acceptance-checks"><label><input type="checkbox" checked={acceptedAdult} onChange={(event) => setAcceptedAdult(event.target.checked)}/><span>I attest that I am at least 18 and have reached the age of majority where I live.</span></label><label><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)}/><span>I have read and accept the <a href="/terms" target="_blank">Terms</a>.</span></label><label><input type="checkbox" checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)}/><span>I have read and accept the <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label></div>{accountType && !acceptanceComplete && <button className="primary-button full acceptance-submit" disabled={accountSaving || !acceptanceReady} onClick={() => saveAccount(accountType)}>{accountSaving ? "Saving…" : "Accept & continue"}</button>}{walletError && <div className="form-error">{walletError}</div>}</section></div>}

      {inboxOpen && (() => {
        const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
        return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInboxOpen(false); }}><section className="inbox-modal" role="dialog" aria-modal="true" aria-labelledby="inbox-title"><button className="modal-close" onClick={() => setInboxOpen(false)} aria-label="Close inbox"><Icon name="close" size={20}/></button><div className="inbox-sidebar"><span className="section-kicker">PRIVATE MESSAGES</span><h2 id="inbox-title">Inbox</h2>{!notificationsEnabled && <button className="notification-opt-in" onClick={enableNotifications}>Add browser alerts</button>}{conversations.length ? conversations.map((conversation) => <button className={conversation.id === activeConversation?.id ? "active" : ""} onClick={() => setActiveConversationId(conversation.id)} key={conversation.id}>{conversation.imageUrl ? <img src={conversation.imageUrl} alt=""/> : <span>{conversation.counterpartName.slice(0, 1).toUpperCase()}</span>}<div><strong>{conversation.counterpartName}{Boolean(conversation.priorityBoostUsdc) && <em className="boost-list-badge">BOOST</em>}</strong><small>{conversation.messages.at(-1)?.body || "New conversation"}</small></div></button>) : <p className="inbox-empty">No conversations yet.</p>}</div><div className="conversation-panel">{activeConversation ? <><header><div><strong>{activeConversation.counterpartName}</strong><span>{activeConversation.blockedByMe ? "You blocked this account" : activeConversation.blockedMe ? "This account has blocked messaging" : "Private conversation"}</span></div><div className="conversation-safety-actions"><button onClick={() => openReport({ conversationId: activeConversation.id, label: `conversation with ${activeConversation.counterpartName}` })}>Report</button><button disabled={safetyBusy} onClick={() => toggleBlock(activeConversation)}>{activeConversation.blockedByMe ? "Unblock" : "Block"}</button></div></header><div className="message-thread">{activeConversation.messages.map((message) => <div className={message.mine ? "message-bubble mine" : "message-bubble"} key={message.id}>{Boolean(message.boostAmountUsdc) && <span className="message-boost-badge">BOOSTED · {formatUsdc(message.boostAmountUsdc || 0)} USDC</span>}<p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString()}</small>{!message.mine && <button className="message-report" onClick={() => openReport({ conversationId: activeConversation.id, messageId: message.id, label: "message" })}>Report</button>}</div>)}</div>{(messageGate || activeConversation.messageGate !== "OPEN") && <aside className="message-limit-notice"><strong>Crypto Sugar reminder</strong><p>{messageGate?.error || (activeConversation.messageGate === "WARNING" ? "You have sent two messages without a reply. Your third message will require confirmation, then please wait for a reply." : activeConversation.messageGate === "PAID_UNLOCK_READY" ? "Your weekly paid-message unlock is ready for one additional message." : "You have sent three messages without a reply. Please wait for a response before continuing.")}</p>{messageGate?.code === "UNANSWERED_WARNING" && <button type="button" disabled={messageBusy || !replyText.trim()} onClick={() => submitReply({ acknowledgeUnansweredWarning: true })}>Send third message</button>}{(messageGate?.hasPaidUnlock || activeConversation.hasPaidUnlock) && <button type="button" disabled={messageBusy || !replyText.trim()} onClick={() => submitReply({ usePaidUnlock: true })}>Send with paid unlock</button>}{(messageGate?.canPurchaseUnlock || activeConversation.canPurchaseUnlock) && activeConversation.messageGate !== "WARNING" && <button type="button" disabled={paymentBusy} onClick={async () => { const conversationId = messageGate?.conversationId || activeConversation.id; if (await purchaseMessageUnlock(conversationId)) { await loadMessages(false); setMessageGate(null); } }}>{paymentBusy ? "Confirming…" : "Unlock one message · 10 USDC"}</button>}{!(messageGate?.canPurchaseUnlock || activeConversation.canPurchaseUnlock || messageGate?.hasPaidUnlock || activeConversation.hasPaidUnlock) && (messageGate?.nextUnlockAt || activeConversation.nextUnlockAt) && <small>Next paid unlock: {new Date(messageGate?.nextUnlockAt || activeConversation.nextUnlockAt || "").toLocaleString()}</small>}</aside>}{activeConversation.blockedByMe || activeConversation.blockedMe ? <div className="messaging-disabled">Messaging is disabled for this conversation.</div> : <form onSubmit={sendReply}><textarea required maxLength={800} value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Write a message…"/><button className="primary-button message-send-button" type="submit" disabled={messageBusy || (activeConversation.messageGate !== "OPEN" && activeConversation.messageGate !== "WARNING")}>{messageBusy ? "Sending…" : "Send message"}</button></form>}</> : <div className="conversation-empty"><Icon name="message" size={31}/><h3>Your private conversations</h3><p>Open an approved creator profile to begin a free conversation.</p></div>}</div></section></div>;
      })()}

      {reportTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !safetyBusy) setReportTarget(null); }}><section className="message-modal report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title"><button className="modal-close" onClick={() => setReportTarget(null)} aria-label="Close report"><Icon name="close" size={20}/></button><span className="section-kicker">CONFIDENTIAL SAFETY REPORT</span><h2 id="report-title">Report {reportTarget.label}.</h2><p className="wallet-intro">Reports are reviewed by an administrator. Use immediate local emergency or trafficking services when someone may be in danger.</p><form onSubmit={submitReport}><label><span>CATEGORY</span><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="HARASSMENT">Harassment or threats</option><option value="SPAM">Spam</option><option value="SCAM">Scam or fraud</option><option value="EXTORTION">Extortion</option><option value="UNDERAGE">Suspected underage user</option><option value="TRAFFICKING">Trafficking or coercion</option><option value="IMPERSONATION">Impersonation</option><option value="OTHER">Other safety concern</option></select></label><label className="message-field"><span>WHAT HAPPENED?</span><textarea required minLength={10} maxLength={1500} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Add dates, context, and specific conduct. Never include a recovery phrase or private key."/><small>{reportDetails.length}/1500</small></label><button className="primary-button full" type="submit" disabled={safetyBusy}>{safetyBusy ? "Submitting…" : "Submit confidential report"}</button></form></section></div>}

      {emailAuthOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !emailBusy) setEmailAuthOpen(false); }}><section className="wallet-modal email-auth-modal" role="dialog" aria-modal="true" aria-labelledby="email-auth-title"><button className="modal-close" onClick={() => setEmailAuthOpen(false)} aria-label="Close email sign-in"><Icon name="close" size={20}/></button><span className="section-kicker">FREE PRIVATE ACCESS</span><h2 id="email-auth-title">Sign in with email.</h2><p className="wallet-intro">Use a one-time code to create a creator or customer account, submit a creator profile with up to eight photos free, and message for free. No password or wallet is required.</p>{emailChallengeId ? <form className="email-auth-form" onSubmit={verifyEmailCode}><label><span>SIX-DIGIT CODE</span><input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000"/></label><button className="primary-button full" type="submit" disabled={emailBusy || emailCode.length !== 6}>{emailBusy ? "Checking…" : "Verify & sign in"}</button><button className="wallet-show-all" type="button" disabled={emailBusy} onClick={() => setEmailChallengeId("")}>Use a different email</button></form> : <form className="email-auth-form" onSubmit={requestEmailCode}><label><span>EMAIL ADDRESS</span><input autoFocus type="email" autoComplete="email" required value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} placeholder="you@example.com"/></label><button className="primary-button full" type="submit" disabled={emailBusy}>{emailBusy ? "Sending…" : "Email me a sign-in code"}</button></form>}{walletError && <div className="form-error">{walletError}</div>}<div className="email-wallet-divider"><span>or</span></div><button className="secondary-button full" type="button" onClick={() => { setEmailAuthOpen(false); showWalletPicker(); }}><Icon name="wallet" size={17}/>Connect a wallet instead</button><p className="wallet-safety"><Icon name="lock" size={14}/>Connect a wallet to send or receive paid ❤️ likes, 💰 gifts, and 💸 boosts 🚀</p></section></div>}

      {walletPickerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !walletBusy) setWalletPickerOpen(false); }}><section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title"><button className="modal-close" onClick={() => setWalletPickerOpen(false)} aria-label="Close wallet options"><Icon name="close" size={20}/></button><span className="section-kicker">{walletContext === "profile" ? "CONNECT BEFORE CREATING" : walletNetworkFilter === "evm" ? basePaymentsLive ? "BASE WALLET & PAYMENTS" : "BASE WALLET SIGN-IN" : walletNetworkFilter === "solana" ? "SOLANA WALLET & PAYMENTS" : "SIGN IN WITHOUT GAS"}</span><h2 id="wallet-title">{walletNetworkFilter === "evm" ? "Connect on Base." : walletNetworkFilter === "solana" ? "Connect on Solana." : "Choose your wallet."}</h2><p className="wallet-intro">{walletContext === "profile" ? "Connect a wallet before creating a profile. After signing in, choose whether this wallet belongs to a Sugar Babe creator or a private Sugar Daddy customer." : "Connecting requests a free signature to verify ownership. It does not give Crypto Sugar permission to move funds."}</p><div className="wallet-options">{walletNetworkFilter !== "solana" && <><button onClick={() => connectEvmWallet("browser")} disabled={walletBusy}><span className="wallet-logo base-logo">B</span><span><strong>Base browser wallet</strong><small>{basePaymentsLive ? "Base · live USDC payments · MetaMask · Rabby · Coinbase" : "Sign-in only · MetaMask · Rabby · Coinbase"}</small></span><Icon name="arrow" size={18}/></button><button onClick={() => connectEvmWallet("binance")} disabled={walletBusy}><span className="wallet-logo binance-logo">B</span><span><strong>Binance Wallet</strong><small>{basePaymentsLive ? "Base · live USDC payments · extension or WalletConnect" : "Base sign-in · extension; mobile via WalletConnect"}</small></span><Icon name="arrow" size={18}/></button><button onClick={() => connectEvmWallet("trust")} disabled={walletBusy}><span className="wallet-logo trust-logo">T</span><span><strong>Trust Wallet</strong><small>{basePaymentsLive ? "Base · live USDC payments · extension or WalletConnect" : "Base sign-in · extension; mobile via WalletConnect"}</small></span><Icon name="arrow" size={18}/></button><button onClick={connectWalletConnect} disabled={walletBusy}><span className="wallet-logo walletconnect-logo">W</span><span><strong>WalletConnect</strong><small>{basePaymentsLive ? "Base · live USDC payments · compatible mobile wallets" : "Base sign-in · compatible mobile wallets"}</small></span><Icon name="arrow" size={18}/></button></>}{walletNetworkFilter !== "evm" && <><button onClick={() => connectSolanaWallet("solflare")} disabled={walletBusy}><span className="wallet-logo solflare-logo">S</span><span><strong>Solflare</strong><small>Solana · live USDC payments</small></span><Icon name="arrow" size={18}/></button><button onClick={() => connectSolanaWallet("phantom")} disabled={walletBusy}><span className="wallet-logo phantom-logo">P</span><span><strong>Phantom</strong><small>Solana · live USDC payments</small></span><Icon name="arrow" size={18}/></button></>}</div>{walletNetworkFilter && <button className="wallet-show-all" type="button" onClick={() => setWalletNetworkFilter(null)}>Show all wallet options</button>}{walletError && <div className="form-error">{walletError}</div>}<div className="wallet-setup"><strong>Don&apos;t have a wallet?</strong><span>Set one up with <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask</a>, <a href="https://www.solflare.com/" target="_blank" rel="noreferrer">Solflare</a>, <a href="https://phantom.com/download" target="_blank" rel="noreferrer">Phantom</a>, <a href="https://www.binance.com/en/web3wallet" target="_blank" rel="noreferrer">Binance</a>, or <a href="https://trustwallet.com/download" target="_blank" rel="noreferrer">Trust Wallet</a>.</span></div><p className="wallet-safety"><Icon name="lock" size={14}/>We never request your seed phrase or private key.</p></section></div>}

      {profileOpen && <div className="modal-backdrop profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><button className="modal-close" onClick={() => setProfileOpen(false)} aria-label="Close profile creator"><Icon name="close" size={20}/></button><div className="create-heading"><h2 id="create-title">Create your profile.</h2><p>Preview your free profile, then submit when you are ready. Profiles and photos are reviewed regularly by administrators.</p></div><form onSubmit={submitProfile}>
        <div className="photo-field"><label className={profilePhotos.length ? "has-photo" : ""}>{profilePhotos.length ? <div className="photo-preview-grid">{profilePhotos.slice(0, 8).map((photo, index) => <img src={photo} alt={`Profile preview ${index + 1}`} key={`${photo.slice(-24)}-${index}`}/>)}</div> : <span><Icon name="camera" size={28}/><strong>Add up to 8 photos free</strong><small>JPG, PNG or WebP · 5 MB each</small></span>}<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={profileSaving || profilePhotos.length >= 8} onChange={(event) => handlePhotos(event.target.files)}/></label><div><strong>Your photo collection</strong><p>Photos are free to upload, optimized, stripped of location metadata, and reviewed regularly by administrators.</p><small>{profilePhotos.length}/8 photos selected</small>{profilePhotos.length > 0 && <button type="button" disabled={profileSaving} onClick={() => { setProfilePhotos([]); setProfileFiles([]); }}>Remove all</button>}</div></div>
        <div className="form-grid"><label><span>DISPLAY NAME</span><input required value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} placeholder="Your first name"/></label><label><span>AGE</span><input required type="number" min="18" max="99" value={profileForm.age} onChange={(event) => setProfileForm({ ...profileForm, age: event.target.value })} placeholder="18+"/></label><label><span>COUNTRY</span><input required value={profileForm.country} onChange={(event) => setProfileForm({ ...profileForm, country: event.target.value })} placeholder="Portugal"/></label><label><span>REGION</span><select required value={profileForm.region} onChange={(event) => setProfileForm({ ...profileForm, region: event.target.value })}><option value="" disabled>Select region</option>{REGIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>HEADLINE</span><input required maxLength={90} value={profileForm.headline} onChange={(event) => setProfileForm({ ...profileForm, headline: event.target.value })} placeholder="A little intrigue goes a long way"/></label><label className="wide"><span>ABOUT YOU</span><textarea required maxLength={500} value={profileForm.bio} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })} placeholder="Your world, your style, and the kind of connection you value…"/></label><label className="wide"><span>INTERESTS</span><input value={profileForm.interests} onChange={(event) => setProfileForm({ ...profileForm, interests: event.target.value })} placeholder="Travel, art, fine dining, wellness"/><small>Separate up to five interests with commas.</small></label></div>
        {walletError && !walletPickerOpen && <div className="form-error">{walletError}</div>}<div className="form-footer"><p>{walletChain === "solana" ? `Earnings enabled with ${walletName || "Solana"}` : wallet && walletChain === "evm" && basePaymentsLive ? `Earnings enabled with ${walletName || "Base"}` : wallet ? "Base sign-in connected; link Solana to enable earnings" : basePaymentsLive ? "Email access is enough to submit; connect Base or Solana later to earn" : "Email access is enough to submit; connect Solana later to earn"}</p><button className="primary-button profile-publish-button" type="submit" disabled={profileSaving}>{profileSaving ? `Saving${profileFiles.length ? " & uploading…" : "…"}` : "Submit"}<Icon name="arrow" size={18}/></button></div>
      </form></section></div>}

      {paymentBusy && paymentExpiresAt && <div className="payment-deadline" role="status"><Icon name="lock" size={13}/>Secure quote expires in {Math.max(0, Math.ceil((new Date(paymentExpiresAt).getTime() - paymentClock) / 1000 / 60))} min</div>}
      {(notice || (walletError && !walletPickerOpen && !profileOpen)) && <div className={`toast ${walletError ? "error" : ""}`}>{walletError || notice}</div>}
    </main>
  );
}
