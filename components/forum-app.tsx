"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { InstagramLink } from "@/components/instagram-link";
import { XLink } from "@/components/x-link";

type Category = { id: string; name: string; description: string; topicCount: number };
type TopicSummary = {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  excerpt: string;
  status: "PUBLISHED" | "LOCKED";
  pinned: boolean;
  authorName: string;
  authorType: "CREATOR" | "CUSTOMER" | null;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
};
type Topic = Omit<TopicSummary, "excerpt" | "replyCount" | "lastActivityAt"> & { body: string };
type ForumPost = { id: string; body: string; authorName: string; authorType: "CREATOR" | "CUSTOMER" | null; createdAt: string };
type Account = { type: "CREATOR" | "CUSTOMER" | null; displayName: string | null; acceptance: { complete: boolean } };

function dateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "numeric", month: "short", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function memberLabel(type: TopicSummary["authorType"]) {
  return type === "CREATOR" ? "Sugar Babe" : type === "CUSTOMER" ? "Sugar Daddy" : "Member";
}

export default function ForumApp() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("lounge");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canPost = authenticated && Boolean(account?.type) && Boolean(account?.acceptance.complete);

  const loadForum = useCallback(async () => {
    const response = await fetch("/api/forums", { cache: "no-store" });
    const data = await response.json() as { categories?: Category[]; topics?: TopicSummary[]; error?: string };
    if (!response.ok) throw new Error(data.error || "The forums could not be loaded.");
    setCategories(data.categories || []);
    setTopics(data.topics || []);
  }, []);

  const openTopic = useCallback(async (topicId: string, updateHistory = true) => {
    setError("");
    const response = await fetch(`/api/forums/${topicId}`, { cache: "no-store" });
    const data = await response.json() as { topic?: Topic; posts?: ForumPost[]; error?: string };
    if (!response.ok || !data.topic) throw new Error(data.error || "This discussion could not be loaded.");
    setActiveTopic(data.topic);
    setPosts(data.posts || []);
    if (updateHistory) window.history.pushState({}, "", `/forums?topic=${encodeURIComponent(topicId)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    Promise.all([
      loadForum(),
      fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/account", { cache: "no-store" }).then((response) => response.json())
    ]).then(async ([, sessionData, accountData]) => {
      setAuthenticated(Boolean(sessionData.authenticated));
      setAccount(accountData.account || null);
      const topicId = new URLSearchParams(window.location.search).get("topic");
      if (topicId) await openTopic(topicId, false);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "The forums could not be loaded."))
      .finally(() => setLoading(false));
  }, [loadForum, openTopic]);

  useEffect(() => {
    function onHistoryChange() {
      const topicId = new URLSearchParams(window.location.search).get("topic");
      if (topicId) openTopic(topicId, false).catch((caught) => setError(caught instanceof Error ? caught.message : "Discussion unavailable."));
      else { setActiveTopic(null); setPosts([]); }
    }
    window.addEventListener("popstate", onHistoryChange);
    return () => window.removeEventListener("popstate", onHistoryChange);
  }, [openTopic]);

  const filteredTopics = useMemo(
    () => selectedCategory === "all" ? topics : topics.filter((topic) => topic.categoryId === selectedCategory),
    [selectedCategory, topics]
  );

  function closeTopic() {
    setActiveTopic(null);
    setPosts([]);
    window.history.pushState({}, "", "/forums");
  }

  function requestParticipation() {
    if (!authenticated) {
      window.location.href = "/?signin=1";
      return;
    }
    if (!account?.type) {
      window.location.href = "/?account=1";
      return;
    }
    if (!account.acceptance.complete) {
      window.location.href = "/dashboard";
      return;
    }
    setCreateOpen(true);
  }

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/forums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, title, body })
      });
      const data = await response.json() as { id?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error || "Your discussion could not be published.");
      setCreateOpen(false);
      setTitle("");
      setBody("");
      window.location.href = `/forums/${encodeURIComponent(data.id)}`;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your discussion could not be published.");
    } finally {
      setBusy(false);
    }
  }

  async function createReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTopic) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/forums/${activeTopic.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Your reply could not be published.");
      setReply("");
      await Promise.all([loadForum(), openTopic(activeTopic.id, false)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your reply could not be published.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="forum-shell">
    <header className="site-header forum-site-header">
      <div className="brand-social"><a className="brand" href="/" aria-label="Crypto Sugar Babes home"><img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a><InstagramLink/><XLink/></div>
      <nav aria-label="Main navigation"><a href="/how-it-works">How it works</a><a className="forum-nav-current" href="/forums">Forums</a></nav>
      <div className="header-actions">
        {authenticated ? <><a className="text-button dashboard-link" href="/dashboard">Dashboard</a><a className="wallet-button connected" href="/dashboard"><span className="online-dot"/>{account?.displayName || memberLabel(account?.type || null)}</a></> : <a className="wallet-button" href="/?signin=1">Sign in</a>}
      </div>
    </header>

    {!activeTopic ? <>
      <section className="forum-hero">
        <div><span>THE SUGAR CIRCLE</span><h1>Forums</h1><p>Open conversation, shared knowledge and respectful connections. Everyone can read; members can join the discussion.</p></div>
        <button className="primary-button" onClick={requestParticipation}>Start a discussion</button>
      </section>

      <section className="forum-content">
        <div className="forum-category-tabs" aria-label="Forum categories">
          <button className={selectedCategory === "all" ? "active" : ""} onClick={() => setSelectedCategory("all")}><strong>All discussions</strong><span>{topics.length}</span></button>
          {categories.map((category) => <button key={category.id} className={selectedCategory === category.id ? "active" : ""} onClick={() => setSelectedCategory(category.id)}><strong>{category.name}</strong><span>{category.topicCount}</span></button>)}
        </div>

        <div className="forum-grid">
          <section className="forum-topic-list" aria-live="polite">
            <div className="forum-list-heading"><div><span>COMMUNITY DISCUSSIONS</span><h2>{selectedCategory === "all" ? "Latest conversations" : categories.find((item) => item.id === selectedCategory)?.name}</h2></div><button onClick={requestParticipation}>New topic</button></div>
            {loading ? <div className="forum-empty">Opening the forum…</div> : filteredTopics.length ? filteredTopics.map((topic) => <a className="forum-topic-row" href={`/forums/${topic.id}`} key={topic.id}>
              <span className="forum-avatar">{topic.authorName.slice(0, 1).toUpperCase()}</span>
              <span className="forum-topic-copy"><span className="forum-topic-meta">{topic.pinned && <b>PINNED</b>}{topic.categoryName}</span><strong>{topic.title}</strong><small>{topic.excerpt}</small><span>By {topic.authorName} · {memberLabel(topic.authorType)}</span></span>
              <span className="forum-topic-activity"><strong>{topic.replyCount}</strong><span>{topic.replyCount === 1 ? "reply" : "replies"}</span><small>{dateLabel(topic.lastActivityAt)}</small></span>
            </a>) : <div className="forum-empty"><strong>No discussions here yet.</strong><span>Be the first member to begin one.</span><button onClick={requestParticipation}>Start a discussion</button></div>}
          </section>

          <aside className="forum-sidebar">
            <span>COMMUNITY STANDARD</span><h2>Warm conversation. Clear boundaries.</h2><p>Keep discussions respectful, protect personal information and report anything that feels unsafe.</p>
            <a href="/safety">Read our safety guidance →</a>
            <div><strong>{authenticated ? "You are signed in" : "Public viewing"}</strong><span>{authenticated ? "Your member session works here automatically." : "Sign in only when you want to post or reply."}</span></div>
          </aside>
        </div>
      </section>
    </> : <section className="forum-discussion-page">
      <button className="forum-back" onClick={closeTopic}>← All discussions</button>
      <article className="forum-opening-post">
        <div className="forum-post-author"><span className="forum-avatar">{activeTopic.authorName.slice(0, 1).toUpperCase()}</span><div><strong>{activeTopic.authorName}</strong><small>{memberLabel(activeTopic.authorType)}</small></div></div>
        <div className="forum-post-content"><span>{activeTopic.categoryName}</span><h1>{activeTopic.title}</h1><p>{activeTopic.body}</p><small>{dateLabel(activeTopic.createdAt)}</small></div>
      </article>
      <div className="forum-reply-count">{posts.length} {posts.length === 1 ? "reply" : "replies"}</div>
      <div className="forum-replies">{posts.map((post) => <article key={post.id}>
        <div className="forum-post-author"><span className="forum-avatar">{post.authorName.slice(0, 1).toUpperCase()}</span><div><strong>{post.authorName}</strong><small>{memberLabel(post.authorType)}</small></div></div>
        <div className="forum-post-content"><p>{post.body}</p><small>{dateLabel(post.createdAt)}</small></div>
      </article>)}</div>
      {activeTopic.status === "LOCKED" ? <div className="forum-locked">This discussion is closed to new replies.</div> : canPost ? <form className="forum-reply-form" onSubmit={createReply}><label htmlFor="forum-reply">Join the conversation</label><textarea id="forum-reply" maxLength={4000} required value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a thoughtful reply…"/><button disabled={busy || reply.trim().length < 2}>{busy ? "Posting…" : "Post reply"}</button></form> : <div className="forum-participation"><strong>Want to join the conversation?</strong><span>{!authenticated ? "Sign in with email or wallet to reply." : !account?.type ? "Choose your member account type first." : "Accept the current membership terms from your dashboard first."}</span><button onClick={requestParticipation}>{!authenticated ? "Sign in" : "Continue"}</button></div>}
    </section>}

    {error && <div className="forum-toast" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

    {createOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}><section className="forum-create-modal" role="dialog" aria-modal="true" aria-labelledby="new-topic-title"><button className="modal-close" onClick={() => setCreateOpen(false)} aria-label="Close">×</button><span>NEW DISCUSSION</span><h2 id="new-topic-title">Start a conversation.</h2><form onSubmit={createTopic}><label>Category<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Title<input required minLength={5} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What would you like to discuss?"/></label><label>Your post<textarea required minLength={10} maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share the details, invite perspectives and keep it respectful…"/></label><button disabled={busy}>{busy ? "Publishing…" : "Publish discussion"}</button></form></section></div>}

    <footer className="forum-footer"><div className="brand-social"><a className="brand" href="/"><img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></a><InstagramLink/><XLink/></div><span>© 2026 Crypto Sugar Babes. Safety First Always.</span><nav><a href="/crypto-safety">Crypto safety</a><a href="/safety">Safety</a><a href="/disputes">Disputes</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></nav></footer>
  </main>;
}
