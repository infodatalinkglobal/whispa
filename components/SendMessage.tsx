"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { newToken, readSent, rememberSent, type SentMessage } from "@/lib/inbox";
import { timeAgo } from "@/lib/constants";

const MAX = 500;

type Status = "loading" | "ok" | "paused" | "missing" | "error";

function friendly(message: string): string {
  if (message.includes("too_many")) return "You're sending too fast. Try again in a few minutes.";
  if (message.includes("inbox_paused")) return "This inbox is paused right now.";
  if (message.includes("inbox_not_found")) return "This link isn't active any more.";
  return "Couldn't send. Please try again.";
}

// The public page behind someone's personal link: anyone can send, no account needed.
export default function SendMessage({ code }: { code: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSent, setJustSent] = useState(false);
  const [sent, setSent] = useState<SentMessage[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});

  // Replies come back by presenting the secrets this browser kept, so only this browser can see them.
  const loadReplies = useCallback(
    async (list: SentMessage[]) => {
      if (list.length === 0) return;
      const { data } = await supabase.rpc("get_message_replies", { p_tokens: list.map((m) => m.token) });
      const map: Record<string, string> = {};
      (data as { ord: number; reply: string | null }[] | null)?.forEach((row) => {
        const m = list[row.ord - 1];
        if (m && row.reply) map[m.token] = row.reply;
      });
      setReplies(map);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("inbox_status", { p_code: code });
      if (cancelled) return;
      setStatus(error ? "error" : ((data as string) as Status));
      const list = readSent(code);
      setSent(list);
      loadReplies(list);
    })();
    const refresh = () => {
      if (document.visibilityState === "visible") loadReplies(readSent(code));
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [code, loadReplies]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    setError("");
    const token = newToken();
    const { error } = await supabase.rpc("send_anonymous_message", { p_code: code, p_content: content, p_token: token });
    setBusy(false);
    if (error) {
      if (error.message.includes("inbox_paused")) setStatus("paused");
      if (error.message.includes("inbox_not_found")) setStatus("missing");
      return setError(friendly(error.message));
    }
    setSent(rememberSent(code, { token, content, at: Date.now() }));
    setText("");
    setJustSent(true);
  }

  const shell = (children: React.ReactNode) => (
    <div className="relative w-full max-w-sm animate-fade-up">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/25 blur-[90px]"
      />
      <div className="relative">
        <p className="font-display text-lg font-bold text-ink">
          Whispa <span>🤫</span>
        </p>
        {children}
      </div>
    </div>
  );

  if (status === "loading") return shell(<p className="mt-10 text-muted">Loading…</p>);

  if (status === "missing" || status === "error") {
    return shell(
      <>
        <h1 className="mt-6 text-[34px] font-bold leading-tight text-ink">This link isn&apos;t active.</h1>
        <p className="mt-3 text-muted">
          {status === "error"
            ? "We couldn't reach Whispa. Check your connection and try again."
            : "The owner may have made a new link. Ask them for the latest one."}
        </p>
        <Link href="/" className="mt-6 inline-block font-semibold text-accent-dark">
          Open Whispa →
        </Link>
      </>
    );
  }

  return shell(
    <>
      <h1 className="mt-6 text-[40px] font-bold leading-[1.05] tracking-tight text-ink">
        Send an
        <br />
        <span className="text-accent-dark">anonymous message.</span>
      </h1>
      <p className="mt-3 text-[17px] leading-snug text-muted">They&apos;ll never know it&apos;s you. 🤫</p>

      {status === "paused" ? (
        <p className="mt-8 rounded-2xl border border-line bg-soft px-4 py-4 text-sm text-muted">
          This inbox is paused right now. Try again later.
        </p>
      ) : justSent ? (
        <div className="mt-8 rounded-3xl border border-accent/40 bg-accent/10 p-5 text-center">
          <p className="text-3xl">🤫</p>
          <p className="mt-2 text-lg font-bold text-ink">Sent!</p>
          <p className="mt-1 text-sm text-muted">They&apos;ll see it in their inbox. You stay anonymous.</p>
          <button
            onClick={() => setJustSent(false)}
            className="mt-4 rounded-full border border-accent/40 bg-white px-5 py-2 text-sm font-semibold text-accent-dark transition active:scale-95"
          >
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="mt-8 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX}
            rows={5}
            autoFocus
            placeholder="Type your anonymous message..."
            className="w-full resize-none rounded-2xl border border-[#eaeaea] bg-white px-4 py-3 text-[17px] leading-6 text-ink outline-none transition placeholder:text-[#aaa] focus:border-accent"
          />
          <p className="text-right text-xs tabular-nums text-muted">
            {text.length}/{MAX}
          </p>
          {error && (
            <p role="alert" className="text-sm text-hot">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="w-full rounded-full bg-accent py-4 text-lg font-bold text-white shadow-[0_8px_28px_rgba(0,215,114,0.4)] transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send anonymously 🤫"}
          </button>
        </form>
      )}

      {sent.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your messages</h2>
          <ul className="mt-3 space-y-3">
            {sent.map((m) => (
              <li key={m.token} className="rounded-2xl border border-line bg-white p-3.5 shadow-sm">
                <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-ink">{m.content}</p>
                <p className="mt-1 text-[11px] text-muted">Sent {timeAgo(new Date(m.at).toISOString())}</p>
                {replies[m.token] ? (
                  <div className="mt-2 rounded-xl bg-accent/10 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-dark">Their reply</p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug text-ink">
                      {replies[m.token]}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">No reply yet.</p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Replies show up here, on this phone and browser only. If you clear your browser data or use another phone,
            you won&apos;t see them.
          </p>
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-line bg-soft p-4 text-center">
        <p className="text-sm font-semibold text-ink">Want anonymous messages too?</p>
        <p className="mt-0.5 text-sm text-muted">Get your own link on Whispa.</p>
        <Link
          href="/inbox"
          className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition active:scale-95"
        >
          Get my link
        </Link>
      </div>
    </>
  );
}
