import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ForumReplyForm } from "@/components/forum-reply-form";
import { InstagramLink } from "@/components/instagram-link";
import { XLink } from "@/components/x-link";
import { getPublicForumTopic } from "@/lib/forum-public";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

function descriptionFor(body: string) {
  const plain = body.replace(/\s+/g, " ").trim();
  return plain.length > 155 ? `${plain.slice(0, 152)}…` : plain;
}

function memberLabel(type: "CREATOR" | "CUSTOMER" | null) {
  return type === "CREATOR" ? "Sugar Babe" : type === "CUSTOMER" ? "Sugar Daddy" : "Member";
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(value);
}

export async function generateMetadata({ params }: { params: Promise<{ topicId: string }> }): Promise<Metadata> {
  const { topicId } = await params;
  const result = await getPublicForumTopic(topicId);
  if (!result) return { title: "Discussion not found | Crypto Sugar Babes", robots: { index: false, follow: false } };

  const description = descriptionFor(result.topic.body);
  return {
    title: `${result.topic.title} | Crypto Sugar Babes Forums`,
    description,
    alternates: { canonical: `/forums/${result.topic.id}` },
    openGraph: {
      type: "article",
      title: result.topic.title,
      description,
      url: `/forums/${result.topic.id}`,
      publishedTime: result.topic.createdAt.toISOString(),
      modifiedTime: result.topic.updatedAt.toISOString(),
    },
  };
}

export default async function ForumTopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const result = await getPublicForumTopic(topicId).catch(() => null);
  if (!result) notFound();

  const { topic, posts } = result;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: topic.title,
    text: topic.body,
    url: absoluteUrl(`/forums/${topic.id}`),
    datePublished: topic.createdAt.toISOString(),
    dateModified: topic.updatedAt.toISOString(),
    author: { "@type": "Person", name: topic.authorName },
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    commentCount: posts.length,
    comment: posts.map((post) => ({
      "@type": "Comment",
      text: post.body,
      dateCreated: post.createdAt.toISOString(),
      author: { "@type": "Person", name: post.authorName },
    })),
  };

  return <main className="forum-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/>
    <header className="site-header forum-site-header">
      <div className="brand-social"><Link className="brand" href="/" aria-label="Crypto Sugar Babes home"><img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></Link><InstagramLink/><XLink/></div>
      <nav aria-label="Main navigation"><Link href="/how-it-works">How it works</Link><Link className="forum-nav-current" href="/forums">Forums</Link></nav>
      <div className="header-actions"><Link className="wallet-button" href="/?signin=1">Sign in</Link></div>
    </header>

    <section className="forum-discussion-page">
      <Link className="forum-back" href="/forums">← All discussions</Link>
      <article className="forum-opening-post">
        <div className="forum-post-author"><span className="forum-avatar">{topic.authorName.slice(0, 1).toUpperCase()}</span><div><strong>{topic.authorName}</strong><small>{memberLabel(topic.authorType)}</small></div></div>
        <div className="forum-post-content"><span>{topic.categoryName}</span><h1>{topic.title}</h1><p>{topic.body}</p><small>{dateLabel(topic.createdAt)}</small></div>
      </article>
      <div className="forum-reply-count">{posts.length} {posts.length === 1 ? "reply" : "replies"}</div>
      <div className="forum-replies">{posts.map((post) => <article key={post.id}>
        <div className="forum-post-author"><span className="forum-avatar">{post.authorName.slice(0, 1).toUpperCase()}</span><div><strong>{post.authorName}</strong><small>{memberLabel(post.authorType)}</small></div></div>
        <div className="forum-post-content"><p>{post.body}</p><small>{dateLabel(post.createdAt)}</small></div>
      </article>)}</div>
      {topic.status === "LOCKED" ? <div className="forum-locked">This discussion is closed to new replies.</div> : <ForumReplyForm topicId={topic.id}/>}
    </section>

    <footer className="forum-footer"><div className="brand-social"><Link className="brand" href="/"><img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/><span>Crypto Sugar Babes</span></Link><InstagramLink/><XLink/></div><span>© 2026 Crypto Sugar Babes. Safety First Always.</span><nav><Link href="/crypto-safety">Crypto safety</Link><Link href="/safety">Safety</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav></footer>
  </main>;
}
