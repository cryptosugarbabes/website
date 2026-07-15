"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { base } from "viem/chains";
import { createPublicClient, createWalletClient, custom, erc20Abi, getAddress, http } from "viem";
import { Profile, profiles } from "@/lib/profiles";
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
type ConversationMessage = { id: string; body: string; mine: boolean; status: string; createdAt: string };
type Conversation = { id: string; profileId: string; counterpartName: string; creatorName: string; imageUrl?: string | null; updatedAt: string; messages: ConversationMessage[] };
type PaymentKind = "PAID_LIKE" | "GIFT" | "MESSAGE_BOOST";
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
  city: "",
  country: "",
  headline: "",
  bio: "",
  interests: ""
};

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
      {profile.imageUrl ? <img src={profile.imageUrl} alt="" /> : <><div className="moon"/><div className="horizon horizon-back"/><div className="horizon horizon-front"/><span className={large ? "modal-monogram" : "profile-monogram"}>{profile.initials}</span></>}
      {profile.sample && <span className="sample-photo-badge">EDITORIAL SAMPLE</span>}
      {!large && profile.online && <span className="profile-online">ONLINE</span>}
    </div>
  );
}

export function DiscoveryApp() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Anywhere");
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletChain, setWalletChain] = useState<WalletChain | null>(null);
  const [walletName, setWalletName] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountDisplayName, setAccountDisplayName] = useState("");
  const [accountBio, setAccountBio] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const evmProviderRef = useRef<EthereumProvider | null>(null);
  const solanaProviderRef = useRef<SolanaProvider | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then(async (data: { address: string | null; chain: WalletChain | null }) => {
      setWallet(data.address);
      setWalletChain(data.chain);
      if (data.chain) setWalletName(data.chain === "solana" ? "Solana" : "Base");
      if (data.address) await Promise.all([loadAccount(), loadFavorites()]);
    }).catch(() => undefined);
  }, []);

  async function loadPersistedProfiles() {
    const response = await fetch("/api/profiles", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { profiles?: Profile[] };
    setCustomProfiles(data.profiles || []);
  }

  async function loadAccount(openWhenMissing = false) {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json() as { account?: { type: AccountType | null; displayName?: string | null; bio?: string | null; generosityPoints?: number } | null };
    const account = data.account || null;
    setAccountType(account?.type || null);
    setAccountDisplayName(account?.displayName || "");
    setAccountBio(account?.bio || "");
    if (account?.generosityPoints) setSupportGivenUsdc(account.generosityPoints);
    if (openWhenMissing && !account?.type) setAccountOpen(true);
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
    if (!activeConversationId && next[0]) setActiveConversationId(next[0].id);
    if (open) setInboxOpen(true);
  }

  async function openInbox() {
    if (!wallet) { setWalletPickerOpen(true); return; }
    if (!accountType) { setAccountOpen(true); return; }
    try { await loadMessages(true); } catch (error) { setWalletError(error instanceof Error ? error.message : "Messages could not be loaded."); }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversationId || !replyText.trim()) return;
    setMessageBusy(true); setWalletError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: activeConversationId, body: replyText }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Your reply could not be sent.");
      setReplyText("");
      await loadMessages(false);
    } catch (error) { setWalletError(error instanceof Error ? error.message : "Your reply could not be sent."); }
    finally { setMessageBusy(false); }
  }

  useEffect(() => {
    loadPersistedProfiles().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const allProfiles = useMemo(() => [...customProfiles, ...profiles], [customProfiles]);
  const cities = useMemo(() => ["Anywhere", ...new Set(allProfiles.map((profile) => profile.city))], [allProfiles]);
  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allProfiles.filter((profile) => {
      const matchesCity = city === "Anywhere" || profile.city === city;
      const matchesQuery = !needle || [profile.name, profile.city, profile.country, profile.headline, ...profile.tags].join(" ").toLowerCase().includes(needle);
      return matchesCity && matchesQuery;
    });
  }, [allProfiles, city, query]);

  async function requestSignIn(address: string, chain: WalletChain) {
    const response = await fetch("/api/auth/nonce", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, chain }) });
    const data = (await response.json()) as { message?: string; error?: string };
    if (!response.ok || !data.message) throw new Error(data.error || "Could not start sign-in.");
    return data.message;
  }

  async function verifySignIn(address: string, chain: WalletChain, message: string, signature: string, name: string) {
    const response = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, chain, message, signature }) });
    const data = (await response.json()) as { address?: string; chain?: WalletChain; error?: string };
    if (!response.ok || !data.address) throw new Error(data.error || "Sign-in failed.");
    setWallet(data.address);
    setWalletChain(data.chain || chain);
    setWalletName(name);
    setWalletPickerOpen(false);
    setNotice(`${name} verified. Welcome to Crypto Sugar.`);
    await Promise.all([loadPersistedProfiles(), loadAccount(true), loadFavorites()]);
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

  async function disconnectWallet() {
    await fetch("/api/auth/logout", { method: "POST" });
    setWallet(null);
    setWalletChain(null);
    setWalletName("");
    setAccountType(null);
    setFavorites(new Set());
    setConversations([]);
    evmProviderRef.current = null;
    solanaProviderRef.current = null;
    await loadPersistedProfiles();
    setNotice("Signed out of Crypto Sugar.");
  }

  async function toggleFavorite(profile: Profile) {
    if (profile.sample) {
      setNotice("Editorial samples cannot be saved. Try this with an approved creator profile.");
      return;
    }
    if (!wallet) {
      setWalletError("Connect your wallet to save favorites.");
      setWalletPickerOpen(true);
      return;
    }
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
    if (wallet && accountType === "CUSTOMER") {
      setNotice("Sugar Daddy accounts stay private and cannot publish creator profiles.");
      return;
    }
    setProfileOpen(true);
  }

  async function saveAccount(type: AccountType) {
    if (!wallet) { setWalletPickerOpen(true); return; }
    if (type === "CUSTOMER" && !accountDisplayName.trim()) { setWalletError("Add a private display name for your customer account."); return; }
    setAccountSaving(true); setWalletError("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, displayName: accountDisplayName, bio: accountBio }) });
      const data = await response.json() as { account?: { type: AccountType }; error?: string };
      if (!response.ok) throw new Error(data.error || "Your account could not be saved.");
      setAccountType(type);
      setAccountOpen(false);
      setNotice(type === "CREATOR" ? "Creator account ready. Build your public profile next." : "Private Sugar Daddy account ready.");
      if (type === "CREATOR") setProfileOpen(true);
    } catch (error) { setWalletError(error instanceof Error ? error.message : "Your account could not be saved."); }
    finally { setAccountSaving(false); }
  }

  function handlePhotos(fileList?: FileList | null) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (profilePhotos.length + files.length > 20) {
      setWalletError("You can add up to 20 photos to a profile.");
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
    if (!wallet) {
      setWalletError("Connect a wallet before starting a conversation.");
      setWalletPickerOpen(true);
      return;
    }
    if (profile.sample) { setNotice("Editorial samples cannot receive messages. Try an approved creator profile."); return; }
    if (!accountType) { setAccountOpen(true); return; }
    if (accountType !== "CUSTOMER") { setNotice("Creator accounts reply from their inbox; they cannot initiate customer conversations."); return; }
    setMessageText("");
    setMessageBoostAmount("");
    setMessageTarget(profile);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageTarget || !messageText.trim()) return;
    const boostAmount = Number(messageBoostAmount || 0);
    if (!Number.isFinite(boostAmount) || boostAmount < 0 || boostAmount > 100_000) {
      setWalletError("Choose a valid optional boost amount.");
      return;
    }
    setMessageBusy(true); setWalletError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId: messageTarget.id, body: messageText }) });
      const data = await response.json() as { conversationId?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Your message could not be sent.");
      const target = messageTarget;
      setMessageTarget(null); setMessageText("");
      await loadMessages(false);
      if (boostAmount > 0) await settlePayment(target, "MESSAGE_BOOST", String(boostAmount));
      else setNotice(`Your message to ${target.name} was delivered.`);
    } catch (error) { setWalletError(error instanceof Error ? error.message : "Your message could not be sent."); }
    finally { setMessageBusy(false); setMessageBoostAmount(""); }
  }

  async function paymentQuote(profile: Profile, kind: PaymentKind, amountUsdc?: string) {
    const response = await fetch("/api/payments/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profileId: profile.id, kind, amountUsdc }) });
    const data = await response.json() as PaymentQuote & { error?: string };
    if (!response.ok) throw new Error(data.error || "A secure payment quote could not be created.");
    return data;
  }

  async function confirmPayment(quote: PaymentQuote, transactionHashes: string[]) {
    const response = await fetch("/api/payments/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteId: quote.quoteId, transactionHashes }) });
    const data = await response.json() as { confirmed?: boolean; error?: string };
    if (!response.ok || !data.confirmed) throw new Error(data.error || "The payment could not be confirmed on-chain.");
  }

  async function settleBasePayment(quote: PaymentQuote, profileId: string) {
    const provider = evmProviderRef.current || injectedEvmProvider("browser");
    if (!provider || !wallet) throw new Error("Reconnect your Base wallet so it can approve the USDC transfers.");
    await switchToBase(provider);
    const accounts = await provider.request({ method: "eth_accounts" }) as string[];
    if (!accounts[0] || getAddress(accounts[0]) !== getAddress(wallet)) throw new Error("The active Base wallet does not match your signed-in account.");
    const walletClient = createWalletClient({ account: getAddress(wallet), chain: base, transport: custom(provider) });
    const publicClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });
    const token = getAddress(quote.tokenAddress);
    const transfer = async (recipient: string, amount: string) => {
      const args = [getAddress(recipient), BigInt(amount)] as const;
      await publicClient.simulateContract({ account: getAddress(wallet), address: token, abi: erc20Abi, functionName: "transfer", args });
      const hash = await walletClient.writeContract({ account: getAddress(wallet), chain: base, address: token, abi: erc20Abi, functionName: "transfer", args });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt.status !== "success") throw new Error("A Base USDC transfer reverted.");
      return hash;
    };

    const storageKey = "crypto-sugar-pending-base-payment";
    const stored = (() => { try { return JSON.parse(window.localStorage.getItem(storageKey) || "null") as { profileId: string; quote: PaymentQuote; creatorHash?: string } | null; } catch { return null; } })();
    const pending = stored?.profileId === profileId && stored.quote.quoteId === quote.quoteId ? stored : { profileId, quote };
    let creatorHash = pending.creatorHash;
    if (!creatorHash) {
      creatorHash = await transfer(quote.creatorAddress, quote.creatorMicros);
      window.localStorage.setItem(storageKey, JSON.stringify({ ...pending, creatorHash }));
    }
    const platformHash = await transfer(quote.treasuryAddress, quote.platformMicros);
    await confirmPayment(quote, [creatorHash, platformHash]);
    window.localStorage.removeItem(storageKey);
  }

  async function settleSolanaPayment(quote: PaymentQuote) {
    const provider = solanaProviderRef.current || window.solflare || window.phantom?.solana || window.solana;
    if (!provider?.signAndSendTransaction || !wallet) throw new Error("Reconnect Solflare or Phantom so it can approve the USDC transaction.");
    const [{ Connection, PublicKey, Transaction }, token] = await Promise.all([import("@solana/web3.js"), import("@solana/spl-token")]);
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    const owner = new PublicKey(wallet);
    const mint = new PublicKey(quote.tokenAddress);
    const creator = new PublicKey(quote.creatorAddress);
    const treasury = new PublicKey(quote.treasuryAddress);
    const sourceAta = token.getAssociatedTokenAddressSync(mint, owner);
    const creatorAta = token.getAssociatedTokenAddressSync(mint, creator);
    const treasuryAta = token.getAssociatedTokenAddressSync(mint, treasury);
    if (!await connection.getAccountInfo(sourceAta)) throw new Error("This Solana wallet does not have a USDC token account.");
    const transaction = new Transaction();
    if (!await connection.getAccountInfo(creatorAta)) transaction.add(token.createAssociatedTokenAccountInstruction(owner, creatorAta, creator, mint));
    if (!await connection.getAccountInfo(treasuryAta)) transaction.add(token.createAssociatedTokenAccountInstruction(owner, treasuryAta, treasury, mint));
    transaction.add(
      token.createTransferCheckedInstruction(sourceAta, mint, creatorAta, owner, BigInt(quote.creatorMicros), 6),
      token.createTransferCheckedInstruction(sourceAta, mint, treasuryAta, owner, BigInt(quote.platformMicros), 6)
    );
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = owner;
    transaction.recentBlockhash = latest.blockhash;
    const sent = await provider.signAndSendTransaction(transaction);
    const signature = typeof sent === "string" ? sent : sent.signature;
    const confirmation = await connection.confirmTransaction({ signature, ...latest }, "confirmed");
    if (confirmation.value.err) throw new Error("The Solana USDC transaction failed.");
    await confirmPayment(quote, [signature]);
  }

  async function settlePayment(profile: Profile, kind: PaymentKind, amountUsdc?: string) {
    if (profile.sample) { setNotice("Editorial samples cannot receive real payments."); return; }
    if (!wallet) { setWalletError("Connect a matching wallet before paying."); setWalletPickerOpen(true); return; }
    if (!accountType) { setAccountOpen(true); return; }
    if (accountType !== "CUSTOMER") { setNotice("Only private customer accounts can send paid support."); return; }
    setPaymentBusy(true); setWalletError("");
    try {
      const pending = walletChain === "evm" ? (() => { try { return JSON.parse(window.localStorage.getItem("crypto-sugar-pending-base-payment") || "null") as { profileId: string; quote: PaymentQuote } | null; } catch { return null; } })() : null;
      if (pending && (pending.profileId !== profile.id || pending.quote.kind !== kind)) {
        throw new Error("Finish the pending Base payment before starting another one.");
      }
      const quote = pending?.profileId === profile.id && pending.quote.kind === kind
        ? pending.quote
        : await paymentQuote(profile, kind, amountUsdc);
      if (quote.network === "BASE") await settleBasePayment(quote, profile.id);
      else await settleSolanaPayment(quote);
      const amount = Number(quote.grossAmountUsdc);
      setSupportGivenUsdc((current) => current + amount);
      await Promise.all([loadPersistedProfiles(), loadAccount()]);
      setNotice(`${kind === "PAID_LIKE" ? "Paid like" : kind === "GIFT" ? "Gift" : "Message boost"} confirmed on-chain: ${formatUsdc(amount)} USDC split 90/10.`);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "The payment was not completed.");
    } finally { setPaymentBusy(false); }
  }

  async function likeFeaturedPhoto(profile: Profile) {
    await settlePayment(profile, "PAID_LIKE");
  }

  function openGift(profile: Profile) {
    if (!wallet) {
      setWalletError("Connect a wallet before sending a gift.");
      setWalletPickerOpen(true);
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
    if (!wallet) {
      setWalletError("Connect and verify a wallet before saving your profile.");
      setWalletPickerOpen(true);
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
      setProfileForm(emptyProfile);
      setProfilePhotos([]);
      setProfileFiles([]);
      setProfileOpen(false);
      setCity("Anywhere");
      setQuery("");
      window.setTimeout(() => document.querySelector("#discover")?.scrollIntoView({ behavior: "smooth" }), 80);
      setNotice("Your profile is saved permanently and is waiting for review.");
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
        <a className="brand" href="#top" aria-label="Crypto Sugar Babes home"><img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a>
        <nav aria-label="Main navigation"><a href="#discover">Discover</a><a href="#how-it-works">How it works</a><a href="#safety">Safety</a></nav>
        <div className="header-actions">
          {accountType !== "CUSTOMER" && <button className="text-button" onClick={openProfileCreator}>Create profile</button>}
          {wallet && accountType && <button className="text-button inbox-button" onClick={openInbox}>Inbox</button>}
          {wallet && !accountType && <button className="text-button" onClick={() => setAccountOpen(true)}>Choose account</button>}
          {wallet ? <button className="wallet-button connected" onClick={disconnectWallet} title="Click to sign out"><span className="online-dot"/>{accountType === "CREATOR" ? "Creator" : accountType === "CUSTOMER" ? "Customer" : walletName || (walletChain === "solana" ? "Solana" : "Base")} · {shortAddress(wallet)}</button>
            : <button className="wallet-button" onClick={() => { setWalletError(""); setWalletPickerOpen(true); }}><Icon name="wallet" size={17}/>Connect wallet</button>}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy-block">
          <div className="eyebrow"><span/> PRIVATE. MAGNETIC. CRYPTO-NATIVE. <span/></div>
          <h1>Crypto is the<br/>ultimate <em>sugar.</em></h1>
          <p className="hero-copy">A discreet, adults-only circle for exceptional people, electric chemistry, and connections worth crossing borders for.</p>
          <div className="hero-actions"><a className="primary-button" href="#discover">Explore profiles <Icon name="arrow" size={18}/></a><button className="secondary-button" onClick={openProfileCreator}>Create your profile — free</button></div>
          <div className="trust-row"><span><Icon name="shield" size={17}/>Adults verified</span><span><Icon name="lock" size={17}/>Wallet-secured</span><span><Icon name="globe" size={17}/>Global access</span></div>
        </div>
      </section>

      <section className="desire-strip" aria-label="Platform values"><span>Private introductions</span><i/><span>Verified adults</span><i/><span>Global chemistry</span><i/><span>USDC-ready</span></section>

      <section className="discovery-section" id="discover">
        <div className="section-heading"><div><span className="section-kicker">CURATED DISCOVERY</span><h2>Someone unforgettable is closer than you think.</h2></div><p>Every public profile is reviewed before it appears in discovery.</p></div>
        <div className="filter-bar">
          <label className="search-field"><Icon name="search" size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search interests or destinations"/></label>
          <label className="select-field"><span>LOCATION</span><select value={city} onChange={(event) => setCity(event.target.value)}>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="filter-meta"><Icon name="check" size={16}/>Reviewed profiles</div>
        </div>
        <div className="profile-grid">
          {filteredProfiles.map((profile) => <article className="profile-card" key={profile.id}>
            <button className={`favorite-button ${favorites.has(profile.id) ? "active" : ""}`} onClick={() => toggleFavorite(profile)} aria-label={`${favorites.has(profile.id) ? "Remove" : "Add"} ${profile.name} ${favorites.has(profile.id) ? "from" : "to"} favorites`}><Icon name="heart" size={18} filled={favorites.has(profile.id)}/></button>
            <button className="profile-open" onClick={() => setActiveProfile(profile)} aria-label={`View ${profile.name}'s profile`}>
              <ProfileArtwork profile={profile}/>
              <div className="profile-content"><div className="profile-name-row"><h3>{profile.name}, {profile.age}</h3>{profile.sample ? <span className="sample-badge">SAMPLE</span> : profile.verified ? <span className="verified-badge" title="Identity verified"><Icon name="check" size={12}/></span> : <span className="draft-badge">{profile.reviewStatus === "PENDING_REVIEW" ? "IN REVIEW" : profile.reviewStatus === "REJECTED" ? "CHANGES NEEDED" : "DRAFT"}</span>}</div><p className="location">{profile.city} · {profile.country}</p><p className="headline">{profile.headline}</p><div className="tag-row">{profile.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
            </button>
          </article>)}
        </div>
        {filteredProfiles.length === 0 && <div className="empty-state">No profiles match those filters yet.</div>}
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-heading compact"><div><span className="section-kicker">DESIRE, WITH STANDARDS</span><h2>Private by design. Free to join.</h2></div></div>
        <div className="steps-grid">
          <div className="step-card"><span className="step-number">01</span><Icon name="wallet" size={26}/><h3>Choose your wallet</h3><p>Connect a Base or Solana wallet and sign a free message. No payment or blockchain transaction is made.</p></div>
          <div className="step-card"><span className="step-number">02</span><Icon name="user" size={26}/><h3>Create your profile</h3><p>Introduce yourself, add your style and interests, then submit for adult identity review. Women are never charged to publish.</p></div>
          <div className="step-card"><span className="step-number">03</span><Icon name="message" size={26}/><h3>Follow the chemistry</h3><p>Discover privately, favorite discreetly, and begin conversations with clear intentions and boundaries.</p></div>
        </div>
      </section>

      <section className="crypto-section">
        <div className="crypto-copy"><span className="section-kicker">USDC-READY ACCESS</span><h2>Your wallet is the key.<br/>Not the price of entry.</h2><p>Crypto Sugar supports free wallet authentication on Base and Solana. Connecting proves wallet ownership; it never gives us custody or permission to move funds.</p><ul><li><Icon name="check" size={16}/>MetaMask, Binance, Trust, Rabby, and Coinbase on Base</li><li><Icon name="check" size={16}/>Solflare and Phantom on Solana</li><li><Icon name="check" size={16}/>Messages are free; boosts, paid likes, and gifts are optional</li><li><Icon name="check" size={16}/>No charge to create or publish an approved profile</li></ul></div>
        <div className="access-card"><div className="access-orbit"><Icon name="spark" size={28}/></div><span>FREE MEMBERSHIP</span><h3>Make an entrance.</h3><p>Create a private draft, preview it instantly, and submit it for review when you are ready.</p><div className="access-networks"><span><i className="base-symbol">B</i>Base</span><span><i className="solana-symbol">S</i>Solana</span></div><button className="primary-button full" onClick={openProfileCreator}>Create your profile <Icon name="arrow" size={18}/></button><small>No profile fees. No boost charges. No recovery phrase—ever.</small></div>
      </section>

      <section className="safety-section" id="safety"><div className="safety-mark"><Icon name="shield" size={31}/></div><div><span className="section-kicker">SAFETY IS THE PRODUCT</span><h2>Adults only. Consent always.</h2></div><p>Crypto Sugar is designed for lawful social discovery and companionship. Solicitation, coercion, trafficking, underage users, and non-consensual content are prohibited and subject to immediate removal.</p><a href="mailto:cryptosugarbabes@gmail.com?subject=Safety%20report">Contact safety <Icon name="arrow" size={16}/></a></section>

      <footer><a className="brand" href="#top"><img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a><p>© 2026 Crypto Sugar Babes. Adults only.</p><div><a href="/safety">Safety</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div></footer>

      {activeProfile && (() => {
        const stats = engagementFor(activeProfile);
        return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveProfile(null); }}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <button className="modal-close" onClick={() => setActiveProfile(null)} aria-label="Close profile"><Icon name="close" size={20}/></button>
            <div className="profile-media-column">
              <ProfileArtwork profile={activeProfile} large/>
              <button className="photo-like-button" disabled={paymentBusy} onClick={() => likeFeaturedPhoto(activeProfile)}><Icon name="heart" size={17}/><span>{paymentBusy ? "Confirming…" : "Send a paid like"}</span><strong>{formatUsdc(stats.likePrice)} USDC</strong></button>
              <small>{stats.likes.toLocaleString()} paid likes · Creator receives {formatUsdc(creatorShareUsdc(stats.likePrice))} USDC</small>
            </div>
            <div className="modal-content">
              <span className="verified-line"><Icon name="shield" size={15}/>{activeProfile.sample ? "Editorial sample · Not a real member" : activeProfile.verified ? "Identity verified · 18+" : "Private draft · Not yet reviewed"}</span>
              <h2 id="profile-modal-title">{activeProfile.name}, {activeProfile.age}</h2><p className="location">{activeProfile.city} · {activeProfile.country}</p>
              <h3>{activeProfile.headline}</h3><p className="modal-bio">{activeProfile.bio}</p>
              <div className="creator-stats"><div><span>SUPPORT SCORE</span><strong>{stats.points} pts</strong></div><div><span>PAID LIKES</span><strong>{stats.likes.toLocaleString()}</strong></div><div><span>NEXT LIKE</span><strong>{formatUsdc(stats.likePrice)} USDC</strong></div></div>
              <div className="rating-progress"><span style={{ width: `${stats.progress}%` }}/></div><p className="rating-note">{100 - stats.progress} more paid likes until the next 0.1% like-value increase.</p>
              <div className="tag-row large">{activeProfile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              {wallet && supportGivenUsdc > 0 && <div className="generosity-badge"><Icon name="spark" size={15}/><span>Your generosity</span><strong>{generosityLevel(generosityPoints(supportGivenUsdc))} · {generosityPoints(supportGivenUsdc)} pts</strong></div>}
              <div className="modal-actions"><button className="primary-button" onClick={() => openMessage(activeProfile)}><Icon name="message" size={17}/>Message · Free</button><button className="gift-action" disabled={paymentBusy} onClick={() => openGift(activeProfile)}><Icon name="spark" size={16}/>Gift</button><button className={`heart-action ${favorites.has(activeProfile.id) ? "active" : ""}`} onClick={() => toggleFavorite(activeProfile)}><Icon name="heart" size={19} filled={favorites.has(activeProfile.id)}/></button></div>
              <p className="modal-footnote">Messages are delivered free. Paid likes, gifts, and boosts use USDC and are split 90% to the creator and 10% to the platform after on-chain confirmation.</p>
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
              <div className="boost-panel"><div><span>OPTIONAL MESSAGE BOOST</span><small>Boosted introductions receive priority placement.</small></div><div className="preset-buttons"><button type="button" className={!messageBoostAmount ? "active" : ""} onClick={() => setMessageBoostAmount("")}>Free</button>{[5, 10, 25].map((amount) => <button type="button" className={messageBoostAmount === String(amount) ? "active" : ""} onClick={() => setMessageBoostAmount(String(amount))} key={amount}>{amount} USDC</button>)}</div><label><span>Custom boost</span><input type="number" min="0" max="100000" step="0.01" value={messageBoostAmount} onChange={(event) => setMessageBoostAmount(event.target.value)} placeholder="0.00"/></label></div>
              <div className="message-checkout"><div><span>Normal message</span><strong>Free</strong></div><div><span>Creator support score</span><strong>{stats.points} points</strong></div><div className="message-total"><span>{messageBoostAmount ? "Optional boost" : "Amount due"}</span><strong>{messageBoostAmount ? `${formatUsdc(Number(messageBoostAmount) || 0)} USDC` : "Free"}</strong></div></div>
              <button className="primary-button full" type="submit" disabled={messageBusy || paymentBusy}>{messageBusy || paymentBusy ? "Sending…" : messageBoostAmount ? `Send & boost · ${formatUsdc(Number(messageBoostAmount) || 0)} USDC` : "Send free message"} <Icon name="arrow" size={18}/></button><p className="checkout-note"><Icon name="lock" size={13}/>The message is delivered first. Any optional boost then requires wallet approval and on-chain confirmation.</p>
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

      {accountOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !accountSaving) setAccountOpen(false); }}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><button className="modal-close" onClick={() => setAccountOpen(false)} aria-label="Close account choice"><Icon name="close" size={20}/></button><span className="section-kicker">CHOOSE YOUR SIDE</span><h2 id="account-title">How will you use Crypto Sugar?</h2><p className="wallet-intro">This choice is tied to this wallet. Creator profiles may become public after review; customer profiles always stay private.</p><div className="account-role-grid"><article><Icon name="spark" size={24}/><h3>Sugar Babe</h3><p>Create a public creator profile, upload photos, receive messages, likes, gifts, and boosts.</p><button className="primary-button full" disabled={accountSaving} onClick={() => saveAccount("CREATOR")}>Continue as creator</button></article><article><Icon name="user" size={24}/><h3>Sugar Daddy</h3><p>Keep your account private, save favorites, message creators, and send USDC support.</p><label><span>PRIVATE DISPLAY NAME</span><input maxLength={80} value={accountDisplayName} onChange={(event) => setAccountDisplayName(event.target.value)} placeholder="Your first name or alias"/></label><label><span>PRIVATE BIO · OPTIONAL</span><textarea maxLength={300} value={accountBio} onChange={(event) => setAccountBio(event.target.value)} placeholder="A short private introduction…"/></label><button className="primary-button full" disabled={accountSaving} onClick={() => saveAccount("CUSTOMER")}>Continue as customer</button></article></div>{walletError && <div className="form-error">{walletError}</div>}</section></div>}

      {inboxOpen && (() => {
        const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
        return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInboxOpen(false); }}><section className="inbox-modal" role="dialog" aria-modal="true" aria-labelledby="inbox-title"><button className="modal-close" onClick={() => setInboxOpen(false)} aria-label="Close inbox"><Icon name="close" size={20}/></button><div className="inbox-sidebar"><span className="section-kicker">PRIVATE MESSAGES</span><h2 id="inbox-title">Inbox</h2>{conversations.length ? conversations.map((conversation) => <button className={conversation.id === activeConversation?.id ? "active" : ""} onClick={() => setActiveConversationId(conversation.id)} key={conversation.id}>{conversation.imageUrl ? <img src={conversation.imageUrl} alt=""/> : <span>{conversation.counterpartName.slice(0, 1).toUpperCase()}</span>}<div><strong>{conversation.counterpartName}</strong><small>{conversation.messages.at(-1)?.body || "New conversation"}</small></div></button>) : <p className="inbox-empty">No conversations yet.</p>}</div><div className="conversation-panel">{activeConversation ? <><header><strong>{activeConversation.counterpartName}</strong><span>Wallet-authenticated conversation</span></header><div className="message-thread">{activeConversation.messages.map((message) => <div className={message.mine ? "message-bubble mine" : "message-bubble"} key={message.id}><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString()}</small></div>)}</div><form onSubmit={sendReply}><textarea required maxLength={800} value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Write a reply…"/><button className="primary-button" type="submit" disabled={messageBusy}>{messageBusy ? "Sending…" : "Send"}</button></form></> : <div className="conversation-empty"><Icon name="message" size={31}/><h3>Your private conversations</h3><p>Open an approved creator profile to begin a free conversation.</p></div>}</div></section></div>;
      })()}

      {walletPickerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !walletBusy) setWalletPickerOpen(false); }}><section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title"><button className="modal-close" onClick={() => setWalletPickerOpen(false)} aria-label="Close wallet options"><Icon name="close" size={20}/></button><span className="section-kicker">SIGN IN WITHOUT GAS</span><h2 id="wallet-title">Choose your wallet.</h2><p className="wallet-intro">Connecting requests a free signature to verify ownership. It does not give Crypto Sugar permission to move funds.</p><div className="wallet-options"><button onClick={() => connectEvmWallet("browser")} disabled={walletBusy}><span className="wallet-logo base-logo">B</span><span><strong>Base browser wallet</strong><small>MetaMask · Rabby · Coinbase</small></span><Icon name="arrow" size={18}/></button><button onClick={() => connectEvmWallet("binance")} disabled={walletBusy}><span className="wallet-logo binance-logo">B</span><span><strong>Binance Wallet</strong><small>Browser or Binance app</small></span><Icon name="arrow" size={18}/></button><button onClick={() => connectEvmWallet("trust")} disabled={walletBusy}><span className="wallet-logo trust-logo">T</span><span><strong>Trust Wallet</strong><small>Browser extension</small></span><Icon name="arrow" size={18}/></button><button onClick={connectWalletConnect} disabled={walletBusy}><span className="wallet-logo walletconnect-logo">W</span><span><strong>WalletConnect</strong><small>Trust · Binance · compatible mobile wallets</small></span><Icon name="arrow" size={18}/></button><button onClick={() => connectSolanaWallet("solflare")} disabled={walletBusy}><span className="wallet-logo solflare-logo">S</span><span><strong>Solflare</strong><small>Solana · USDC</small></span><Icon name="arrow" size={18}/></button><button onClick={() => connectSolanaWallet("phantom")} disabled={walletBusy}><span className="wallet-logo phantom-logo">P</span><span><strong>Phantom</strong><small>Solana · USDC</small></span><Icon name="arrow" size={18}/></button></div>{walletError && <div className="form-error">{walletError}</div>}<div className="wallet-setup"><strong>Don&apos;t have a wallet?</strong><span>Set one up with <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask</a>, <a href="https://www.solflare.com/" target="_blank" rel="noreferrer">Solflare</a>, <a href="https://phantom.com/download" target="_blank" rel="noreferrer">Phantom</a>, <a href="https://www.binance.com/en/web3wallet" target="_blank" rel="noreferrer">Binance</a>, or <a href="https://trustwallet.com/download" target="_blank" rel="noreferrer">Trust Wallet</a>.</span></div><p className="wallet-safety"><Icon name="lock" size={14}/>We never request your seed phrase or private key.</p></section></div>}

      {profileOpen && <div className="modal-backdrop profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><button className="modal-close" onClick={() => setProfileOpen(false)} aria-label="Close profile creator"><Icon name="close" size={20}/></button><div className="create-heading"><span className="section-kicker">YOUR PRIVATE INTRODUCTION</span><h2 id="create-title">Create your profile.</h2><p>Preview a free draft now. Public profiles require adult identity review before discovery.</p></div><form onSubmit={submitProfile}>
        <div className="photo-field"><label className={profilePhotos.length ? "has-photo" : ""}>{profilePhotos.length ? <div className="photo-preview-grid">{profilePhotos.slice(0, 4).map((photo, index) => <img src={photo} alt={`Profile preview ${index + 1}`} key={`${photo.slice(-24)}-${index}`}/>)}</div> : <span><Icon name="camera" size={28}/><strong>Add up to 20 photos</strong><small>JPG, PNG or WebP · 5 MB each</small></span>}<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={profileSaving} onChange={(event) => handlePhotos(event.target.files)}/></label><div><strong>Your photo collection</strong><p>Photos are optimized, stripped of location metadata, and kept private until approval.</p><small>{profilePhotos.length}/20 photos selected</small>{profilePhotos.length > 0 && <button type="button" disabled={profileSaving} onClick={() => { setProfilePhotos([]); setProfileFiles([]); }}>Remove all</button>}</div></div>
        <div className="form-grid"><label><span>DISPLAY NAME</span><input required value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} placeholder="Your first name"/></label><label><span>AGE</span><input required type="number" min="18" max="99" value={profileForm.age} onChange={(event) => setProfileForm({ ...profileForm, age: event.target.value })} placeholder="18+"/></label><label><span>CITY</span><input required value={profileForm.city} onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })} placeholder="Lisbon"/></label><label><span>COUNTRY</span><input required value={profileForm.country} onChange={(event) => setProfileForm({ ...profileForm, country: event.target.value })} placeholder="Portugal"/></label><label className="wide"><span>HEADLINE</span><input required maxLength={90} value={profileForm.headline} onChange={(event) => setProfileForm({ ...profileForm, headline: event.target.value })} placeholder="A little intrigue goes a long way"/></label><label className="wide"><span>ABOUT YOU</span><textarea required maxLength={500} value={profileForm.bio} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })} placeholder="Your world, your style, and the kind of connection you value…"/></label><label className="wide"><span>INTERESTS</span><input value={profileForm.interests} onChange={(event) => setProfileForm({ ...profileForm, interests: event.target.value })} placeholder="Travel, art, fine dining, wellness"/><small>Separate up to five interests with commas.</small></label></div>
        {walletError && !walletPickerOpen && <div className="form-error">{walletError}</div>}<div className="form-footer"><p><Icon name="shield" size={15}/>{wallet ? `Connected with ${walletName || walletChain}` : "A verified wallet is required to save"}</p><button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? `Saving${profileFiles.length ? " & uploading…" : "…"}` : wallet ? "Save & submit for review" : "Connect & save"}<Icon name="arrow" size={18}/></button></div>
      </form></section></div>}

      {(notice || (walletError && !walletPickerOpen && !profileOpen)) && <div className={`toast ${walletError ? "error" : ""}`}>{walletError || notice}</div>}
    </main>
  );
}
