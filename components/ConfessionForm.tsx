"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVE_CAMPUSES, CAMPUSES, CATEGORIES, SINGLE_CAMPUS } from "@/lib/constants";
import { STARTERS } from "@/lib/prompts";

const MAX = 500;
const DRAFT_KEY = "whispa_draft";

function initialText(seed: string | null): string {
  let draft = "";
  try {
    draft = localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {}
  if (!seed) return draft;
  // Opened from the daily question: start with the question. An unsent draft is kept underneath, never lost.
  if (!draft.trim()) return `${seed}\n`;
  return draft.startsWith(seed) ? draft : `${seed}\n${draft}`;
}

// Lives inside a BottomSheet. An unsent confession is kept on the device, so closing the sheet by accident
// doesn't lose what the student wrote.
export default function ConfessionForm({
  seed = null,
  onClose,
  onPosted,
}: {
  seed?: string | null;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [content, setContent] = useState(() => initialText(seed));
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Put the cursor after any text that's already there (the question or a saved draft).
  useEffect(() => {
    const el = textarea.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const [campus, setCampus] = useState<string>(ACTIVE_CAMPUSES[0]);
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
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    onPosted();
  }

  function onChange(value: string) {
    setContent(value);
    try {
      localStorage.setItem(DRAFT_KEY, value);
    } catch {}
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
      {content.trim() === "" && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" aria-label="Ideas to start with">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(`${s} `);
                textarea.current?.focus();
              }}
              className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-sm font-medium text-accent-dark transition active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textarea}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX}
        rows={6}
        autoFocus
        placeholder="What's on your mind? Nobody will know..."
        className={`${field} resize-none text-[17px] leading-6`}
      />
      <p className="text-right text-xs tabular-nums text-muted">
        {content.length}/{MAX}
      </p>
      <div className={SINGLE_CAMPUS ? "" : "grid grid-cols-2 gap-3"}>
        {!SINGLE_CAMPUS && (
          <select value={campus} onChange={(e) => setCampus(e.target.value)} className={field} aria-label="Campus">
            {CAMPUSES.filter((c) => ACTIVE_CAMPUSES.includes(c)).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
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
