"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CAMPUSES, CATEGORIES } from "@/lib/constants";

const MAX = 500;
const COOLDOWN_MS = 30_000;
const LAST_KEY = "whispa_last_post";

export default function ConfessionForm({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const [content, setContent] = useState("");
  const [campus, setCampus] = useState<string>(CAMPUSES[0]);
  const [category, setCategory] = useState<string>(CATEGORIES[0].name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (text.length < 3) return setError("Write a bit more first.");

    // Simple per-device rate limit (no login yet).
    try {
      const last = Number(localStorage.getItem(LAST_KEY) || 0);
      if (Date.now() - last < COOLDOWN_MS) return setError("Slow down. Wait a few seconds before posting again.");
    } catch {}

    setBusy(true);
    setError("");
    const { error } = await supabase.from("confessions").insert({ content: text, campus, category });
    setBusy(false);
    if (error) return setError("Couldn't send. Try again.");
    try {
      localStorage.setItem(LAST_KEY, String(Date.now()));
    } catch {}
    onPosted();
  }

  const field = "w-full rounded-xl border border-white/15 bg-[#0a0a0a] px-3 py-3 text-white outline-none focus:border-ghana";

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl space-y-3 rounded-t-2xl border border-white/10 bg-[#141414] p-5 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">New Whispa</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-400">
            ×
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={MAX}
          rows={5}
          autoFocus
          placeholder="What's on your mind? Nobody will know..."
          className={`${field} resize-none`}
        />
        <p className="text-right text-xs text-gray-500">
          {content.length}/{MAX}
        </p>
        <select value={campus} onChange={(e) => setCampus(e.target.value)} className={field}>
          {CAMPUSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
          {CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} {c.emoji}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-ghana py-3 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send Anonymously 🤫"}
        </button>
      </form>
    </div>
  );
}
