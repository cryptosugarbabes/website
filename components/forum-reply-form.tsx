"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function ForumReplyForm({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/forums/${topicId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Your reply could not be published.");
      setReply("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your reply could not be published.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <form className="forum-reply-form" onSubmit={submitReply}>
      <label htmlFor="forum-reply">Join the conversation</label>
      <textarea
        id="forum-reply"
        maxLength={4000}
        minLength={2}
        required
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        placeholder="Write a thoughtful reply…"
      />
      {error && <p className="forum-inline-error" role="alert">{error}</p>}
      <button disabled={busy || reply.trim().length < 2}>{busy ? "Posting…" : "Post reply"}</button>
      <small>Posting requires a member account that has accepted the current terms. <Link href="/?signin=1">Sign in</Link></small>
    </form>
  </>;
}
