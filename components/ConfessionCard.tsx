"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Comments from "./Comments";
import { CAMPUS_SHORT, CATEGORIES, CATEGORY_COLORS, timeAgo, whatsappLink, type Confession } from "@/lib/constants";

type Dir = "up" | "down";
const LONG = 280;
const HOT_SCORE = 5;

export default function ConfessionCard({
  confession,
  isNew,
  index,
  loggedIn,
  onNeedLogin,
  myVote,
  reported,
  onReported,
}: {
  confession: Confession;
  isNew: boolean;
  index: number;
  loggedIn: boolean;
  onNeedLogin: () => void;
  myVote: Dir | null;
  reported: boolean;
  onReported: () => void;
}) {
  const [up, setUp] = useState(confession.upvotes);
  const [down, setDown] = useState(confession.downvotes);
  const [mine, setMine] = useState<Dir | null>(myVote);
  const [pop, setPop] = useState<Dir | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(confession.comments?.[0]?.count ?? 0);
  const [expanded, setExpanded] = useState(false);

  // The account's saved vote loads after the feed does, and clears on log out.
  useEffect(() => {
    setMine(myVote);
  }, [myVote]);

  const emoji = CATEGORIES.find((c) => c.name === confession.category)?.emoji ?? "";
  const color = CATEGORY_COLORS[confession.category] ?? "#7B61FF";
  const long = confession.content.length > LONG;
  const hot = up - down >= HOT_SCORE;

  async function report() {
    if (!loggedIn) return onNeedLogin();
    if (reported) return;
    if (!window.confirm("Report this post as harmful or inappropriate?")) return;
    onReported();
    await supabase.rpc("report_confession", { p_id: confession.id });
  }

  // Moves this account's vote from `from` to `to` in the on-screen counts.
  function shift(from: Dir | null, to: Dir | null) {
    const bump = (d: Dir | null, n: 1 | -1) => {
      if (d === "up") setUp((x) => x + n);
      if (d === "down") setDown((x) => x + n);
    };
    bump(from, -1);
    bump(to, 1);
  }

  // One vote per account: tapping again removes it; tapping the other side switches it.
  async function vote(dir: Dir) {
    if (!loggedIn) return onNeedLogin();
    const prev = mine;
    const next = prev === dir ? null : dir;
    shift(prev, next);
    setMine(next);
    if (next) {
      setPop(next);
      setTimeout(() => setPop(null), 400);
    }
    const { error } = await supabase.rpc("vote_confession", { p_id: confession.id, p_direction: next });
    if (error) {
      shift(next, prev);
      setMine(prev);
    }
  }

  const score = up - down;
  const chevron = (dir: Dir) => (
    <button
      onClick={() => vote(dir)}
      aria-pressed={mine === dir}
      aria-label={dir === "up" ? "Upvote" : "Downvote"}
      className={`flex h-7 w-9 items-center justify-center rounded-lg transition active:scale-90 ${
        mine === dir ? (dir === "up" ? "text-accent" : "text-hot") : "text-muted hover:text-ink"
      }`}
    >
      <svg viewBox="0 0 20 20" className={`h-5 w-5 ${dir === "down" ? "rotate-180" : ""}`} fill="none" aria-hidden="true">
        <path d="M5 12.5 10 7.5l5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  const initials = (CAMPUS_SHORT[confession.campus] ?? confession.campus).slice(0, 2).toUpperCase();

  return (
    <article
      style={{
        borderLeftColor: color,
        borderLeftWidth: 3,
        animationDelay: isNew ? undefined : `${Math.min(index, 8) * 45}ms`,
      }}
      className={`rounded-3xl border border-line bg-card px-4 pb-3 pt-4 ${isNew ? "animate-slide-down" : "animate-fade-up"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            style={{ backgroundColor: `${color}26`, color }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold"
            aria-hidden="true"
          >
            {initials}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[15px] font-bold text-ink">{confession.campus}</p>
            <p className="mt-0.5 text-xs text-muted">Anonymous • {timeAgo(confession.created_at)}</p>
          </div>
        </div>

        <div className="-mt-1 flex shrink-0 flex-col items-center">
          {chevron("up")}
          <span
            className={`font-display text-base font-bold tabular-nums leading-none ${pop ? "animate-pop" : ""} ${
              mine === "up" ? "text-accent" : mine === "down" ? "text-hot" : "text-ink"
            }`}
          >
            {score}
          </span>
          {chevron("down")}
        </div>
      </div>

      <div className={`relative mt-3 ${long && !expanded ? "max-h-44 overflow-hidden" : ""}`}>
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
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

      <div className="mt-3 flex items-center gap-4 border-t border-line pt-3">
        <button
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          aria-label="Replies"
          className={`flex items-center gap-2 text-sm transition active:scale-95 ${
            showComments ? "text-ink" : "text-muted hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
            <path
              d="M10 3.5c-3.6 0-6.5 2.5-6.5 5.6 0 1.7.9 3.2 2.3 4.2L5 16.5l3.3-1.5c.5.1 1.1.2 1.7.2 3.6 0 6.5-2.5 6.5-5.6S13.6 3.5 10 3.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span className="tabular-nums">
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </span>
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
