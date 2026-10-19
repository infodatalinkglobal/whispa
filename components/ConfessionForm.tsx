"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CAMPUSES, CATEGORIES } from "@/lib/constants";

const MAX = 500;

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

    setBusy(true);
    setError("");
    const { error } = await supabase.from("confessions").insert({ content: text, campus, category });
    setBusy(false);
    if (error) {
      // The database limits each account to one post every 30 seconds.
      return setError(
        error.message.includes("too_fast")
          ? "Slow down. Wait a few seconds before posting again."
          : "Couldn't send. Try again."
      );
    }
    onPosted();
  }

  const field =
    "w-full rounded-xl border border-line bg-base px-4 py-3 text-ink outline-none transition placeholder:text-muted focus:border-accent/60";

  return (
    <div
      className="fixed inset-0 z-40 flex animate-fade-in items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl animate-sheet-up space-y-3 rounded-t-3xl border border-line bg-card p-5 pb-6 sm:rounded-3xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold italic">New Whispa 🤫</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-muted transition hover:bg-white/5 hover:text-ink"
          >
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
          className={`${field} resize-none text-[17px] leading-relaxed`}
        />
        <p className="text-right text-xs tabular-nums text-muted">
          {content.length}/{MAX}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <select value={campus} onChange={(e) => setCampus(e.target.value)} className={field} aria-label="Campus">
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={field} aria-label="Category">
            {CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} {c.emoji}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-hot">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-accent py-3.5 font-display text-base font-bold text-[#04140b] shadow-[0_0_28px_rgba(0,197,102,0.3)] transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send Anonymously 🤫"}
        </button>
      </form>
    </div>
  );
}
