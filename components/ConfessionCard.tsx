"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Comments from "./Comments";
import { CATEGORIES, CATEGORY_COLORS, timeAgo, whatsappLink, type Confession } from "@/lib/constants";

type Dir = "up" | "down";
const KEY = "whispa_votes";
const REPORT_KEY = "whispa_reported";
const LONG = 280;
const HOT_SCORE = 5;

function readVotes(): Record<string, Dir> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeVotes(v: Record<string, Dir>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

function readReported(): string[] {
  try {
    return JSON.parse(localStorage.getItem(REPORT_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function ConfessionCard({
  confession,
  isNew,
  index,
}: {
  confession: Confession;
  isNew: boolean;
  index: number;
}) {
  const [up, setUp] = useState(confession.upvotes);
  const [down, setDown] = useState(confession.downvotes);
  const [mine, setMine] = useState<Dir | null>(null);
  const [pop, setPop] = useState<Dir | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(confession.comments?.[0]?.count ?? 0);
  const [reported, setReported] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setMine(readVotes()[confession.id] ?? null);
    setReported(readReported().includes(confession.id));
  }, [confession.id]);

  const emoji = CATEGORIES.find((c) => c.name === confession.category)?.emoji ?? "";
  const color = CATEGORY_COLORS[confession.category] ?? "#7B61FF";
  const long = confession.content.length > LONG;
  const hot = up - down >= HOT_SCORE;

  async function rpc(column: Dir, delta: 1 | -1) {
    await supabase.rpc("vote_confession", { p_id: confession.id, p_column: column, p_delta: delta });
  }

  async function report() {
    if (reported) return;
    if (!window.confirm("Report this post as harmful or inappropriate?")) return;
    setReported(true);
    try {
      localStorage.setItem(REPORT_KEY, JSON.stringify([...readReported(), confession.id]));
    } catch {}
    await supabase.rpc("report_confession", { p_id: confession.id });
  }

  // One vote per device: tapping again removes it; tapping the other side switches it.
  function vote(dir: Dir) {
    const votes = readVotes();
    const prev = votes[confession.id] ?? null;
    const bump = (d: Dir, n: 1 | -1) => (d === "up" ? setUp((x) => x + n) : setDown((x) => x + n));

    if (prev === dir) {
      bump(dir, -1);
      rpc(dir, -1);
      delete votes[confession.id];
      setMine(null);
    } else {
      if (prev) {
        bump(prev, -1);
        rpc(prev, -1);
      }
      bump(dir, 1);
      rpc(dir, 1);
      votes[confession.id] = dir;
      setMine(dir);
      setPop(dir);
      setTimeout(() => setPop(null), 400);
    }
    writeVotes(votes);
  }

  const voteBtn = (dir: Dir, emoji: string, count: number) => (
    <button
      onClick={() => vote(dir)}
      aria-pressed={mine === dir}
      aria-label={dir === "up" ? "Upvote" : "Downvote"}
      className={`flex items-center gap-1.5 text-sm transition active:scale-90 ${
        mine === dir ? (dir === "up" ? "text-accent" : "text-hot") : "text-muted hover:text-ink"
      }`}
    >
      <span className={`inline-block ${pop === dir ? "animate-pop" : ""} ${mine && mine !== dir ? "opacity-50 grayscale" : ""}`}>
        {emoji}
      </span>
      <span className="tabular-nums">{count}</span>
    </button>
  );

  return (
    <article
      style={{
        borderLeftColor: color,
        borderLeftWidth: 3,
        animationDelay: isNew ? undefined : `${Math.min(index, 8) * 45}ms`,
      }}
      className={`rounded-2xl border border-line bg-card px-4 pb-3 pt-4 ${isNew ? "animate-slide-down" : "animate-fade-up"}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-iris/15 px-2.5 py-1 text-xs font-medium text-[#A596FF]">
          <span aria-hidden="true">{emoji}</span>
          {confession.category}
        </span>
        {hot && (
          <span className="inline-flex items-center gap-1 rounded-full bg-hot/15 px-2.5 py-1 text-xs font-semibold text-hot">
            🔥 Hot
          </span>
        )}
      </div>

      <div className={`relative ${long && !expanded ? "max-h-44 overflow-hidden" : ""}`}>
        <p className="whitespace-pre-wrap break-words text-[18px] leading-[1.55] text-ink">{confession.content}</p>
        {long && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/80 to-transparent" />
        )}
      </div>
      {long && (
        <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-sm font-medium text-accent">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <span>Anonymous</span>
        <span aria-hidden="true">•</span>
        <span>{confession.campus}</span>
        <span aria-hidden="true">•</span>
        <span>{timeAgo(confession.created_at)}</span>
      </p>

      <div className="mt-3 flex items-center gap-5 border-t border-line pt-3">
        {voteBtn("up", "👍", up)}
        {voteBtn("down", "👎", down)}
        <button
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          aria-label="Replies"
          className={`flex items-center gap-1.5 text-sm transition active:scale-90 ${
            showComments ? "text-ink" : "text-muted hover:text-ink"
          }`}
        >
          <span>💬</span>
          <span className="tabular-nums">{commentCount}</span>
        </button>

        <a
          href={whatsappLink(confession.campus, confession.content)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-accent" aria-hidden="true">
            <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.78c-1.77 0-3.5-.48-5.01-1.37l-.36-.21-3.72.98 1-3.62-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.9 9.88M20.52 3.45A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.43-8.46" />
          </svg>
          Share
        </a>
      </div>

      <button
        onClick={report}
        disabled={reported}
        className="mt-2 text-[11px] text-muted/70 transition hover:text-muted disabled:hover:text-muted/70"
      >
        {reported ? "Reported. Thanks." : "🚩 Report"}
      </button>

      {showComments && <Comments confessionId={confession.id} onAdded={() => setCommentCount((n) => n + 1)} />}
    </article>
  );
}
