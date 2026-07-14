"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAddress } from "viem";
import { Profile, profiles } from "@/lib/profiles";
import {
  PHOTO_LIKE_CREATOR_SHARE_USDC,
  PHOTO_LIKE_PLATFORM_FEE_USDC,
  PHOTO_LIKE_PRICE_USDC,
  creatorRatingPoints,
  formatUsdc,
  messagePriceUsdc
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
  isPhantom?: boolean;
  isSolflare?: boolean;
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
  const [engagement, setEngagement] = useState<Record<string, { received: number; likes: number }>>({});
  const [messageTarget, setMessageTarget] = useState<Profile | null>(null);
  const [messageText, setMessageText] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then((data: { address: string | null; chain: WalletChain | null }) => {
      setWallet(data.address);
      setWalletChain(data.chain);
      if (data.chain) setWalletName(data.chain === "solana" ? "Solana" : "Base");
    }).catch(() => undefined);
  }, []);

  async function loadPersistedProfiles() {
    const response = await fetch("/api/profiles", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { profiles?: Profile[] };
    setCustomProfiles(data.profiles || []);
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
    await loadPersistedProfiles();
  }

  async function authenticateEvmProvider(provider: EthereumProvider, label: string) {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    if (!accounts[0]) throw new Error(`${label} did not return a wallet address.`);
    const address = getAddress(accounts[0]);
    await switchToBase(provider);
    const message = await requestSignIn(address, "evm");
    const signature = (await provider.request({ method: "personal_sign", params: [message, address] })) as string;
    await verifySignIn(address, "evm", message, signature, label);
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
    await loadPersistedProfiles();
    setNotice("Signed out of Crypto Sugar.");
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openProfileCreator() {
    setWalletError("");
    setProfileOpen(true);
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
    const extra = engagement[profile.id] || { received: 0, likes: 0 };
    const sent = profile.messagesSent || 0;
    const received = (profile.messagesReceived || 0) + extra.received;
    const points = creatorRatingPoints(sent, received);
    return {
      sent,
      received,
      points,
      price: messagePriceUsdc(points),
      likes: (profile.photoLikes || 0) + extra.likes,
      progress: (sent + received) % 100
    };
  }

  function openMessage(profile: Profile) {
    if (!wallet) {
      setWalletError("Connect a wallet before starting a paid conversation.");
      setWalletPickerOpen(true);
      return;
    }
    setMessageText("");
    setMessageTarget(profile);
  }

  function sendTestMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageTarget || !messageText.trim()) return;
    setEngagement((current) => ({
      ...current,
      [messageTarget.id]: {
        received: (current[messageTarget.id]?.received || 0) + 1,
        likes: current[messageTarget.id]?.likes || 0
      }
    }));
    setMessageTarget(null);
    setMessageText("");
    setNotice("Test message recorded. Live USDC settlement is intentionally disabled.");
  }

  function likeFeaturedPhoto(profile: Profile) {
    if (!wallet) {
      setWalletError("Connect a wallet before sending a paid photo-like.");
      setWalletPickerOpen(true);
      return;
    }
    setEngagement((current) => ({
      ...current,
      [profile.id]: {
        received: current[profile.id]?.received || 0,
        likes: (current[profile.id]?.likes || 0) + 1
      }
    }));
    setNotice("Test photo-like recorded: 0.10 USDC creator share + 0.01 platform fee. No funds moved.");
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
          <button className="text-button" onClick={openProfileCreator}>Create profile</button>
          {wallet ? <button className="wallet-button connected" onClick={disconnectWallet} title="Click to sign out"><span className="online-dot"/>{walletName || (walletChain === "solana" ? "Solana" : "Base")} · {shortAddress(wallet)}</button>
            : <button className="wallet-button" onClick={() => { setWalletError(""); setWalletPickerOpen(true); }}><Icon name="wallet" size={17}/>Connect wallet</button>}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy-block">
          <div className="eyebrow"><span/> PRIVATE. MAGNETIC. CRYPTO-NATIVE. <span/></div>
          <h1>Go where <em>desire</em><br/>takes you.</h1>
          <p className="hero-copy">A discreet, adults-only circle for exceptional people, electric chemistry, and connections worth crossing borders for.</p>
          <div className="hero-actions"><a className="primary-button" href="#discover">Explore profiles <Icon name="arrow" size={18}/></a><button className="secondary-button" onClick={openProfileCreator}>Create your profile — free</button></div>
          <div className="trust-row"><span><Icon name="shield" size={17}/>Adults verified</span><span><Icon name="lock" size={17}/>Wallet-secured</span><span><Icon name="globe" size={17}/>Global access</span></div>
        </div>
        <div className="hero-editorial" aria-label="Glamorous private rooftop lounge">
          <div className="editorial-city"><i/><i/><i/><i/><i/></div>
          <div className="editorial-figure" aria-hidden="true"><span className="figure-hair"/><span className="figure-face"/><span className="figure-neck"/><span className="figure-dress"/><span className="figure-highlight"/></div>
          <div className="hero-frame"/>
          <div className="hero-caption"><span>MEMBERS&apos; EDIT</span><strong>Midnight in Europe</strong></div>
          <div className="hero-age">18+</div>
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
            <button className={`favorite-button ${favorites.has(profile.id) ? "active" : ""}`} onClick={() => toggleFavorite(profile.id)} aria-label={`${favorites.has(profile.id) ? "Remove" : "Add"} ${profile.name} ${favorites.has(profile.id) ? "from" : "to"} favorites`}><Icon name="heart" size={18} filled={favorites.has(profile.id)}/></button>
            <button className="profile-open" onClick={() => setActiveProfile(profile)} aria-label={`View ${profile.name}'s profile`}>
              <ProfileArtwork profile={profile}/>
              <div className="profile-content"><div className="profile-name-row"><h3>{profile.name}, {profile.age}</h3>{profile.verified ? <span className="verified-badge" title="Identity verified"><Icon name="check" size={12}/></span> : <span className="draft-badge">{profile.reviewStatus === "PENDING_REVIEW" ? "IN REVIEW" : profile.reviewStatus === "REJECTED" ? "CHANGES NEEDED" : "DRAFT"}</span>}</div><p className="location">{profile.city} · {profile.country}</p><p className="headline">{profile.headline}</p><div className="tag-row">{profile.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
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
        <div className="crypto-copy"><span className="section-kicker">USDC-READY ACCESS</span><h2>Your wallet is the key.<br/>Not the price of entry.</h2><p>Crypto Sugar supports free wallet authentication on Base and Solana. Connecting proves wallet ownership; it never gives us custody or permission to move funds.</p><ul><li><Icon name="check" size={16}/>MetaMask, Binance, Trust, Rabby, and Coinbase on Base</li><li><Icon name="check" size={16}/>Solflare and Phantom on Solana</li><li><Icon name="check" size={16}/>WalletConnect for compatible mobile wallets</li><li><Icon name="check" size={16}/>No charge to create or publish an approved profile</li></ul></div>
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
              <button className="photo-like-button" onClick={() => likeFeaturedPhoto(activeProfile)}><Icon name="heart" size={17}/><span>Like featured photo</span><strong>{PHOTO_LIKE_PRICE_USDC.toFixed(2)} USDC</strong></button>
              <small>{stats.likes.toLocaleString()} paid likes · Creator receives {PHOTO_LIKE_CREATOR_SHARE_USDC.toFixed(2)} USDC</small>
            </div>
            <div className="modal-content">
              <span className="verified-line"><Icon name="shield" size={15}/>{activeProfile.verified ? "Identity verified · 18+" : "Private draft · Not yet reviewed"}</span>
              <h2 id="profile-modal-title">{activeProfile.name}, {activeProfile.age}</h2><p className="location">{activeProfile.city} · {activeProfile.country}</p>
              <h3>{activeProfile.headline}</h3><p className="modal-bio">{activeProfile.bio}</p>
              <div className="creator-stats"><div><span>RATING</span><strong>{stats.points} pts</strong></div><div><span>MESSAGES</span><strong>{(stats.sent + stats.received).toLocaleString()}</strong></div><div><span>YOUR MESSAGE</span><strong>{formatUsdc(stats.price)} USDC</strong></div></div>
              <div className="rating-progress"><span style={{ width: `${stats.progress}%` }}/></div><p className="rating-note">{100 - stats.progress} more messages until the next +5 rating points.</p>
              <div className="tag-row large">{activeProfile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="modal-actions"><button className="primary-button" onClick={() => openMessage(activeProfile)}><Icon name="message" size={17}/>Message · {formatUsdc(stats.price)} USDC</button><button className={`heart-action ${favorites.has(activeProfile.id) ? "active" : ""}`} onClick={() => toggleFavorite(activeProfile.id)}><Icon name="heart" size={19} filled={favorites.has(activeProfile.id)}/></button></div>
              <p className="modal-footnote">Creators send messages free. Incoming message price rises 0.1% per rating point. Test mode does not move funds.</p>
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
            <p className="wallet-intro">Creators reply free. Your message price reflects {messageTarget.name}&apos;s current engagement rating.</p>
            <form onSubmit={sendTestMessage}><label className="message-field"><span>YOUR MESSAGE</span><textarea required maxLength={800} autoFocus value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Start with something thoughtful…"/><small>{messageText.length}/800</small></label>
              <div className="message-checkout"><div><span>Creator rating</span><strong>{stats.points} points</strong></div><div><span>Base price</span><strong>0.30 USDC</strong></div><div className="message-total"><span>Your message</span><strong>{formatUsdc(stats.price)} USDC</strong></div></div>
              <button className="primary-button full" type="submit">Test send · {formatUsdc(stats.price)} USDC <Icon name="arrow" size={18}/></button><p className="checkout-note"><Icon name="lock" size={13}/>Test mode records engagement but does not transfer USDC.</p>
            </form>
          </section>
        </div>;
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
