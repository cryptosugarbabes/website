"use client";

import { FormEvent, useEffect, useState } from "react";

type ReviewProfile = {
  id: string;
  name: string;
  age: number;
  city: string;
  country: string;
  headline: string;
  bio: string;
  interests: string[];
  status: string;
  rejectionReason?: string;
  photos: string[];
};

export function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [profiles, setProfiles] = useState<ReviewProfile[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function loadProfiles() {
    const response = await fetch("/api/admin/profiles", { cache: "no-store" });
    if (response.status === 401) { setSignedIn(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load profiles.");
    setProfiles(data.profiles);
    setSignedIn(true);
  }

  useEffect(() => { loadProfiles().catch((caught) => setError(caught.message)); }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Sign-in failed."); return; }
    setPassword("");
    await loadProfiles();
  }

  async function review(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Reason shown to the creator:")?.trim() : "";
    if (action === "reject" && !reason) return;
    setBusy(id); setError("");
    const response = await fetch(`/api/admin/profiles/${id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Review failed.");
    else await loadProfiles();
    setBusy("");
  }

  if (!signedIn) return <main className="admin-shell"><section className="admin-login"><span>CRYPTO SUGAR BABES</span><h1>Profile review</h1><p>Private administrator access.</p><form onSubmit={login}><input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Administrator password"/><button type="submit">Sign in</button></form>{error && <div className="form-error">{error}</div>}</section></main>;

  return <main className="admin-shell"><header className="admin-header"><div><span>CRYPTO SUGAR BABES</span><h1>Profile review</h1></div><button onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); setSignedIn(false); }}>Sign out</button></header>{error && <div className="form-error">{error}</div>}<section className="review-list">{profiles.length === 0 ? <p className="admin-empty">No profiles have been submitted.</p> : profiles.map((profile) => <article className="review-card" key={profile.id}><div className="review-photos">{profile.photos.length ? profile.photos.map((photo, index) => <img src={photo} alt={`${profile.name} photo ${index + 1}`} key={photo}/>) : <div>No photos</div>}</div><div className="review-copy"><span className={`review-status status-${profile.status.toLowerCase()}`}>{profile.status.replace("_", " ")}</span><h2>{profile.name}, {profile.age}</h2><p className="location">{profile.city} · {profile.country}</p><h3>{profile.headline}</h3><p>{profile.bio}</p><div className="tag-row">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>{profile.rejectionReason && <p className="rejection-note">Previous reason: {profile.rejectionReason}</p>}<div className="review-actions"><button disabled={busy === profile.id} onClick={() => review(profile.id, "approve")}>Approve profile</button><button className="reject" disabled={busy === profile.id} onClick={() => review(profile.id, "reject")}>Reject with reason</button></div></div></article>)}</section></main>;
}
