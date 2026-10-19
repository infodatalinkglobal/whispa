"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CAMPUSES, CATEGORIES } from "@/lib/constants";

const MAX = 500;

// Lives inside a BottomSheet.
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
    "w-full rounded-xl border border-[#eaeaea] bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-[#aaa] focus:border-accent";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">New Whispa 🤫</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-muted transition hover:bg-soft hover:text-ink"
        >
          ×
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={MAX}
        rows={6}
        autoFocus
        placeholder="What's on your mind? Nobody will know..."
        className={`${field} resize-none text-[17px] leading-6`}
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
        className="w-full rounded-full bg-accent py-3.5 text-base font-bold text-white shadow-[0_8px_24px_rgba(0,215,114,0.35)] transition active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send Anonymously 🤫"}
      </button>
    </form>
  );
}
