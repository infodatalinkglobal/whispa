"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { APP_URL, inboxLink, inboxShareLink } from "@/lib/inbox";
import { timeAgo } from "@/lib/constants";
import ShareImageButton from "./ShareImageButton";

type Message = {
  id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  reply: string | null;
  replied_at: string | null;
};

// Your personal link and the anonymous messages people have sent you. Only you can read them.
export default function InboxView() {
  const router = useRouter();
  const { session, ready } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [origin, setOrigin] = useState(APP_URL ?? "");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!APP_URL) setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  const load = useCallback(async () => {
    const [inbox, msgs] = await Promise.all([
      supabase.rpc("get_my_inbox"),
      supabase
        .from("anon_messages")
        .select("id, content, created_at, is_read, reply, replied_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (inbox.error || msgs.error) return setError("Couldn't load your inbox. Check your connection and try again.");
    setError("");
    const row = (inbox.data as { code: string; is_paused: boolean }[])[0];
    setCode(row.code);
    setPaused(row.is_paused);
    const list = msgs.data as Message[];
    setNewIds(new Set(list.filter((m) => !m.is_read).map((m) => m.id)));
    setMessages(list);
    // Opening the inbox marks everything as seen. The dots stay for this visit.
    if (list.some((m) => !m.is_read)) await supabase.rpc("mark_messages_read");
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const link = code ? inboxLink(code, origin) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function togglePause() {
    const next = !paused;
    setPaused(next);
    const { error } = await supabase.rpc("set_inbox_paused", { p_paused: next });
    if (error) setPaused(!next);
  }

  async function resetLink() {
    if (!window.confirm("Make a new link? The old link will stop working straight away.")) return;
    const { data, error } = await supabase.rpc("reset_inbox_link");
    if (error) return window.alert("Couldn't make a new link. Please try again.");
    setCode(data as string);
  }

  async function sendReply(id: string) {
    const reply = replyText.trim();
    if (!reply) return;
    setBusy(true);
    const { error } = await supabase.rpc("reply_to_message", { p_id: id, p_reply: reply });
    setBusy(false);
    if (error) return window.alert("Couldn't send your reply. Please try again.");
    setMessages((list) =>
      (list ?? []).map((m) => (m.id === id ? { ...m, reply, replied_at: new Date().toISOString() } : m))
    );
    setReplyingTo(null);
    setReplyText("");
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this message?")) return;
    const { error } = await supabase.from("anon_messages").delete().eq("id", id);
    if (error) return window.alert("Couldn't delete it. Please try again.");
    setMessages((list) => (list ?? []).filter((m) => m.id !== id));
  }

  async function reportAndBlock(id: string) {
    if (!window.confirm("Report this message and block the sender? They won't be told, and they can't send you more.")) return;
    const { error } = await supabase.rpc("report_and_block", { p_id: id });
    if (error) return window.alert("Couldn't do that. Please try again.");
    setMessages((list) => (list ?? []).filter((m) => m.id !== id));
  }

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  }, []);

  if (!ready || !session) return <p className="py-20 text-center text-muted">Loading…</p>;

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-muted hover:text-ink">
          ← Back to Whispa
        </Link>
        <p className="text-lg font-extrabold tracking-tight text-ink">
          Whispa <span className="text-base">🤫</span>
        </p>
      </div>

      <h1 className="text-[34px] font-bold leading-tight tracking-tight text-ink">
        Your anonymous <span className="text-accent-dark">inbox.</span>
      </h1>
      <p className="mt-2 text-[15px] leading-snug text-muted">
        Share your link. Anyone who opens it can send you a message, and they never have to say who they are.
      </p>

      {error && <p className="mt-6 text-sm text-hot">{error}</p>}

      {code && (
        <section className="mt-6 rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/10 to-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">Your link</p>
          <p className="mt-1 break-all rounded-xl bg-white px-3 py-2.5 font-mono text-[13px] text-ink">{link}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={copy}
              className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white transition active:scale-95"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <a
              href={inboxShareLink(link)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-accent/40 bg-white px-4 py-2 text-sm font-semibold text-accent-dark transition active:scale-95"
            >
              Share on WhatsApp
            </a>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <button onClick={togglePause} className="font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
              {paused ? "▶ Resume link" : "⏸ Pause link"}
            </button>
            <button onClick={resetLink} className="font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
              ↻ Make a new link
            </button>
          </div>
          {paused && (
            <p className="mt-2 text-sm text-hot">Your link is paused. People who open it can&apos;t send you anything.</p>
          )}
        </section>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">
        Messages{messages && messages.length > 0 ? ` (${messages.length})` : ""}
      </h2>

      {messages === null && !error && <p className="mt-4 text-muted">Loading…</p>}

      {messages && messages.length === 0 && (
        <div className="py-14 text-center">
          <p className="text-5xl">💌</p>
          <p className="mt-4 text-lg font-bold text-ink">No messages yet.</p>
          <p className="mt-1 text-sm text-muted">Share your link on your Status or in a class group.</p>
        </div>
      )}

      <ul className="mt-3 space-y-3">
        {messages?.map((m) => (
          <li key={m.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                {newIds.has(m.id) && <span className="h-2 w-2 rounded-full bg-accent" aria-label="New" />}
                Anonymous · {timeAgo(m.created_at)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[17px] leading-6 text-ink">{m.content}</p>

            {m.reply && (
              <div className="mt-3 rounded-xl bg-accent/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-dark">Your reply</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug text-ink">{m.reply}</p>
              </div>
            )}

            {replyingTo === m.id && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  maxLength={500}
                  rows={3}
                  autoFocus
                  placeholder="Write a reply. Only they can see it, on the phone they sent from."
                  className="w-full resize-none rounded-xl border border-[#eaeaea] bg-white px-3 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-[#aaa] focus:border-accent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => sendReply(m.id)}
                    disabled={busy || !replyText.trim()}
                    className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send reply"}
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText("");
                    }}
                    className="rounded-full border border-line px-4 py-1.5 text-sm text-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-sm">
              <button
                onClick={() => {
                  setReplyingTo(m.id);
                  setReplyText(m.reply ?? "");
                }}
                className="font-medium text-accent-dark"
              >
                {m.reply ? "Edit reply" : "Reply"}
              </button>
              <button onClick={() => remove(m.id)} className="font-medium text-muted hover:text-ink">
                Delete
              </button>
              <button onClick={() => reportAndBlock(m.id)} className="font-medium text-muted hover:text-hot">
                Report &amp; block
              </button>
              <span className="ml-auto">
                <ShareImageButton url={`/api/message-card/${m.id}`} headers={authHeaders} filename="whispa-message.png" />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
