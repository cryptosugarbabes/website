"use client";

import { useEffect, useMemo, useState } from "react";
import { encodeFunctionData, getAddress, isAddress, parseUnits } from "viem";
import { Profile, profiles } from "@/lib/profiles";

type EthereumProvider = {
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const BASE_CHAIN_ID = "0x2105";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BOOST_PRICE = "20";

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
  message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></>
};

function Icon({ name, size = 20, filled = false }: { name: string; size?: number; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function switchToBase(provider: EthereumProvider) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_CHAIN_ID }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BASE_CHAIN_ID,
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"]
        }
      ]
    });
  }
}

export function DiscoveryApp() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Anywhere");
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentState, setPaymentState] = useState<"idle" | "sending" | "submitted">("idle");
  const [paymentHash, setPaymentHash] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data: { address: string | null }) => setWallet(data.address))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const cities = useMemo(() => ["Anywhere", ...new Set(profiles.map((profile) => profile.city))], []);
  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      const matchesCity = city === "Anywhere" || profile.city === city;
      const matchesQuery =
        !needle ||
        [profile.name, profile.city, profile.country, profile.headline, ...profile.tags]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return matchesCity && matchesQuery;
    });
  }, [city, query]);

  async function connectWallet() {
    setWalletError("");
    const provider = window.ethereum;
    if (!provider) {
      setWalletError("Install a browser wallet such as MetaMask or Rabby to continue.");
      return null;
    }

    setWalletBusy(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = getAddress(accounts[0]);
      await switchToBase(provider);

      const nonceResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address })
      });
      const nonceData = (await nonceResponse.json()) as { message?: string; error?: string };
      if (!nonceResponse.ok || !nonceData.message) throw new Error(nonceData.error || "Could not start sign-in.");

      const signature = (await provider.request({
        method: "personal_sign",
        params: [nonceData.message, address]
      })) as `0x${string}`;

      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, message: nonceData.message, signature })
      });
      const verifyData = (await verifyResponse.json()) as { address?: string; error?: string };
      if (!verifyResponse.ok || !verifyData.address) throw new Error(verifyData.error || "Sign-in failed.");

      setWallet(verifyData.address);
      setNotice("Wallet verified. Welcome to Crypto Sugar.");
      return verifyData.address;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet connection was cancelled.";
      setWalletError(message);
      return null;
    } finally {
      setWalletBusy(false);
    }
  }

  async function disconnectWallet() {
    await fetch("/api/auth/logout", { method: "POST" });
    setWallet(null);
    setNotice("Signed out of Crypto Sugar.");
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendBoostPayment() {
    setWalletError("");
    const provider = window.ethereum;
    if (!provider) {
      setWalletError("A browser wallet is required to pay with USDC.");
      return;
    }

    const activeWallet = wallet || (await connectWallet());
    if (!activeWallet) return;
    const treasury = process.env.NEXT_PUBLIC_PLATFORM_TREASURY;
    if (!treasury || !isAddress(treasury) || /^0x0{40}$/i.test(treasury)) {
      setWalletError("Add the platform treasury address to .env.local before enabling live payments.");
      return;
    }

    setPaymentState("sending");
    try {
      await switchToBase(provider);
      const data = encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "transfer",
            stateMutability: "nonpayable",
            inputs: [
              { name: "to", type: "address" },
              { name: "value", type: "uint256" }
            ],
            outputs: [{ name: "", type: "bool" }]
          }
        ],
        functionName: "transfer",
        args: [getAddress(treasury), parseUnits(BOOST_PRICE, 6)]
      });
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: activeWallet, to: USDC_BASE, data }]
      })) as string;
      setPaymentHash(hash);
      setPaymentState("submitted");
    } catch (error) {
      setPaymentState("idle");
      setWalletError(error instanceof Error ? error.message : "The payment was cancelled.");
    }
  }

  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Crypto Sugar home">
          <span className="brand-mark"><Icon name="compass" size={21} /></span>
          <span>CRYPTO SUGAR</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#discover">Discover</a>
          <a href="#how-it-works">How it works</a>
          <a href="#safety">Safety</a>
        </nav>
        <div className="header-actions">
          <button className="text-button" onClick={() => setNotice("Profile onboarding is queued for the next build.")}>Create profile</button>
          {wallet ? (
            <button className="wallet-button connected" onClick={disconnectWallet} title="Click to sign out">
              <span className="online-dot" /> {shortAddress(wallet)}
            </button>
          ) : (
            <button className="wallet-button" onClick={connectWallet} disabled={walletBusy}>
              <Icon name="wallet" size={17} /> {walletBusy ? "Check wallet…" : "Connect wallet"}
            </button>
          )}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> Verified adults. Global connections. <span /></div>
        <h1>Go where <em>chemistry</em><br />takes you.</h1>
        <p className="hero-copy">
          A private, adults-only social discovery space for exceptional people, thoughtful experiences,
          and connections that cross borders.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="#discover">Explore profiles <Icon name="arrow" size={18} /></a>
          <button className="secondary-button" onClick={() => setNotice("Profile onboarding is queued for the next build.")}>Create your profile</button>
        </div>
        <div className="trust-row">
          <span><Icon name="shield" size={17} /> Identity checked</span>
          <span><Icon name="lock" size={17} /> Wallet-secured access</span>
          <span><Icon name="globe" size={17} /> Crypto-native</span>
        </div>
      </section>

      <section className="discovery-section" id="discover">
        <div className="section-heading">
          <div>
            <span className="section-kicker">CURATED DISCOVERY</span>
            <h2>Meet someone remarkable.</h2>
          </div>
          <p>Every public profile is reviewed before it appears in discovery.</p>
        </div>

        <div className="filter-bar">
          <label className="search-field">
            <Icon name="search" size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search interests or destinations" />
          </label>
          <label className="select-field">
            <span>LOCATION</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              {cities.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <div className="filter-meta"><Icon name="check" size={16} /> Verified profiles only</div>
        </div>

        <div className="profile-grid">
          {filteredProfiles.map((profile) => (
            <article className="profile-card" key={profile.id}>
              <button
                className={`favorite-button ${favorites.has(profile.id) ? "active" : ""}`}
                onClick={() => toggleFavorite(profile.id)}
                aria-label={`${favorites.has(profile.id) ? "Remove" : "Add"} ${profile.name} ${favorites.has(profile.id) ? "from" : "to"} favorites`}
              >
                <Icon name="heart" size={18} filled={favorites.has(profile.id)} />
              </button>
              <button className="profile-open" onClick={() => setActiveProfile(profile)} aria-label={`View ${profile.name}'s profile`}>
                <div
                  className={`profile-visual motif-${profile.motif}`}
                  style={{ "--tone-one": profile.colors[0], "--tone-two": profile.colors[1], "--tone-three": profile.colors[2] } as React.CSSProperties}
                >
                  <div className="moon" />
                  <div className="horizon horizon-back" />
                  <div className="horizon horizon-front" />
                  <span className="profile-monogram">{profile.initials}</span>
                  {profile.online && <span className="profile-online">ONLINE</span>}
                </div>
                <div className="profile-content">
                  <div className="profile-name-row">
                    <h3>{profile.name}, {profile.age}</h3>
                    {profile.verified && <span className="verified-badge" title="Identity verified"><Icon name="check" size={12} /></span>}
                  </div>
                  <p className="location">{profile.city} · {profile.country}</p>
                  <p className="headline">{profile.headline}</p>
                  <div className="tag-row">{profile.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
                </div>
              </button>
            </article>
          ))}
        </div>
        {filteredProfiles.length === 0 && <div className="empty-state">No profiles match those filters yet.</div>}
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-heading compact">
          <div><span className="section-kicker">PRIVATE BY DESIGN</span><h2>Simple, secure, intentional.</h2></div>
        </div>
        <div className="steps-grid">
          <div className="step-card"><span className="step-number">01</span><Icon name="wallet" size={26} /><h3>Connect privately</h3><p>Use your wallet and sign a free message. No blockchain transaction is made during sign-in.</p></div>
          <div className="step-card"><span className="step-number">02</span><Icon name="user" size={26} /><h3>Verify once</h3><p>Age and identity checks keep discovery adult-only and make every public profile accountable.</p></div>
          <div className="step-card"><span className="step-number">03</span><Icon name="message" size={26} /><h3>Connect with intent</h3><p>Explore thoughtfully, favorite privately, and start conversations with clear boundaries.</p></div>
        </div>
      </section>

      <section className="crypto-section">
        <div className="crypto-copy">
          <span className="section-kicker">BUILT ON BASE</span>
          <h2>One currency.<br />No payment theatre.</h2>
          <p>Crypto Sugar starts with USDC on Base: stable pricing, low network fees, and transparent transaction receipts.</p>
          <ul>
            <li><Icon name="check" size={16} /> Wallet ownership verified by signature</li>
            <li><Icon name="check" size={16} /> USDC settlement on Base</li>
            <li><Icon name="check" size={16} /> No platform custody for direct wallet payments</li>
          </ul>
        </div>
        <div className="boost-card">
          <div className="boost-icon"><Icon name="spark" size={24} /></div>
          <span>PROFILE BOOST</span>
          <h3>Be seen first for 7 days.</h3>
          <p>Move your approved profile to the front of discovery in your selected city.</p>
          <div className="price-line"><strong>20</strong><span>USDC<br /><small>on Base</small></span></div>
          <button className="primary-button full" onClick={() => { setCheckoutOpen(true); setPaymentState("idle"); setPaymentHash(""); setWalletError(""); }}>
            Pay with crypto <Icon name="arrow" size={18} />
          </button>
        </div>
      </section>

      <section className="safety-section" id="safety">
        <div className="safety-mark"><Icon name="shield" size={31} /></div>
        <div><span className="section-kicker">SAFETY IS THE PRODUCT</span><h2>Adults only. Consent always.</h2></div>
        <p>Crypto Sugar is designed for lawful social discovery and companionship. Solicitation, coercion, trafficking, underage users, and non-consensual content are prohibited and subject to immediate removal.</p>
        <a href="mailto:safety@example.com">Contact safety <Icon name="arrow" size={16} /></a>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark"><Icon name="compass" size={19} /></span><span>CRYPTO SUGAR</span></a>
        <p>© 2026 Crypto Sugar Babes. Demo profiles are fictional.</p>
        <div><a href="#safety">Safety</a><a href="#top">Terms</a><a href="#top">Privacy</a></div>
      </footer>

      {activeProfile && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveProfile(null); }}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <button className="modal-close" onClick={() => setActiveProfile(null)} aria-label="Close profile"><Icon name="close" size={20} /></button>
            <div
              className={`modal-visual motif-${activeProfile.motif}`}
              style={{ "--tone-one": activeProfile.colors[0], "--tone-two": activeProfile.colors[1], "--tone-three": activeProfile.colors[2] } as React.CSSProperties}
            >
              <div className="moon" /><div className="horizon horizon-back" /><div className="horizon horizon-front" />
              <span className="modal-monogram">{activeProfile.initials}</span>
            </div>
            <div className="modal-content">
              <span className="verified-line"><Icon name="shield" size={15} /> Identity verified · 18+</span>
              <h2 id="profile-modal-title">{activeProfile.name}, {activeProfile.age}</h2>
              <p className="location">{activeProfile.city} · {activeProfile.country}</p>
              <h3>{activeProfile.headline}</h3>
              <p className="modal-bio">{activeProfile.bio}</p>
              <div className="tag-row large">{activeProfile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="modal-actions">
                <button className="primary-button" onClick={() => wallet ? setNotice("Private messaging is next in the build queue.") : connectWallet()}>
                  <Icon name="message" size={17} /> {wallet ? "Start a conversation" : "Connect to message"}
                </button>
                <button className={`heart-action ${favorites.has(activeProfile.id) ? "active" : ""}`} onClick={() => toggleFavorite(activeProfile.id)}><Icon name="heart" size={19} filled={favorites.has(activeProfile.id)} /></button>
              </div>
                <p className="modal-footnote">Never send funds to arrange prohibited or unlawful services. Report suspicious requests to Safety.</p>
            </div>
          </section>
        </div>
      )}

      {checkoutOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}>
          <section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
            <button className="modal-close" onClick={() => setCheckoutOpen(false)} aria-label="Close checkout"><Icon name="close" size={20} /></button>
            {paymentState === "submitted" ? (
              <div className="payment-success">
                <span className="success-icon"><Icon name="check" size={26} /></span>
                <span className="section-kicker">TRANSACTION SUBMITTED</span>
                <h2 id="checkout-title">Your boost is on its way.</h2>
                <p>We’ll activate it after the USDC transfer is confirmed on Base.</p>
                <a className="primary-button full" href={`https://basescan.org/tx/${paymentHash}`} target="_blank" rel="noreferrer">View transaction <Icon name="arrow" size={17} /></a>
              </div>
            ) : (
              <>
                <span className="section-kicker">SECURE CHECKOUT</span>
                <h2 id="checkout-title">7-day profile boost</h2>
                <p className="checkout-subtitle">Featured placement in one selected city after profile approval.</p>
                <div className="checkout-summary">
                  <div><span>Product</span><strong>Discovery boost</strong></div>
                  <div><span>Network</span><strong><i className="base-dot" /> Base</strong></div>
                  <div className="total"><span>Total</span><strong>20.00 USDC</strong></div>
                </div>
                {wallet && <div className="paying-wallet"><Icon name="wallet" size={16} /> Paying from {shortAddress(wallet)}</div>}
                {walletError && <div className="form-error">{walletError}</div>}
                <button className="primary-button full" onClick={sendBoostPayment} disabled={paymentState === "sending" || walletBusy}>
                  {paymentState === "sending" ? "Confirm in wallet…" : wallet ? "Pay 20 USDC" : "Connect wallet to pay"}
                  {paymentState !== "sending" && <Icon name="arrow" size={18} />}
                </button>
                <p className="checkout-note"><Icon name="lock" size={13} /> Crypto Sugar never requests your recovery phrase or private key.</p>
              </>
            )}
          </section>
        </div>
      )}

      {(notice || walletError) && !checkoutOpen && <div className={`toast ${walletError ? "error" : ""}`}>{walletError || notice}</div>}
    </main>
  );
}
