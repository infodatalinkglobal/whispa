"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { timeAgo, type Comment } from "@/lib/constants";

const MAX = 300;
const COOLDOWN_MS = 10_000;
const LAST_KEY = "whispa_last_comment";

export default function Comments({ confessionId, onAdded }: { confessionId: string; onAdded: () => void }) {
  const [items, setItems] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("comments")
      .select("id, content, created_at")
      .eq("confession_id", confessionId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) setError("Couldn't load replies.");
    else setItems(data as Comment[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confessionId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    try {
      const last = Number(localStorage.getItem(LAST_KEY) || 0);
      if (Date.now() - last < COOLDOWN_MS) return setError("Slow down a little.");
    } catch {}
    setBusy(true);
    setError("");
    const { error } = await supabase.from("comments").insert({ confession_id: confessionId, content: body });
    setBusy(false);
    if (error) return setError("Couldn't send. Try again.");
    try {
      localStorage.setItem(LAST_KEY, String(Date.now()));
    } catch {}
    setText("");
    onAdded();
    load();
  }

  return (
    <div className="mt-3 animate-fade-in space-y-2 border-t border-line pt-3">
      {items === null && !error && <p className="text-sm text-muted">Loading…</p>}
      {items?.length === 0 && <p className="text-sm text-muted">No replies yet. Say something 🤫</p>}
      {items?.map((c) => (
        <div key={c.id} className="animate-fade-up rounded-xl bg-white/[0.04] px-3 py-2.5">
          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-ink">{c.content}</p>
          <p className="mt-1 text-[11px] text-muted">Anonymous • {timeAgo(c.created_at)}</p>
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-2 pt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX}
          placeholder="Reply anonymously..."
          className="min-w-0 flex-1 rounded-full border border-line bg-base px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/60"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-[#04140b] transition active:scale-95 disabled:opacity-40"
        >
          Reply
        </button>
      </form>
      {error && <p className="text-sm text-hot">{error}</p>}
    </div>
  );
}
