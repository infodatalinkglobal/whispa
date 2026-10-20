"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Comments from "./Comments";
import ShareImageButton from "./ShareImageButton";
import ShareLink from "./ShareLink";
import {
  CAMPUS_SHORT,
  CATEGORIES,
  CATEGORY_STYLES,
  REACTIONS,
  timeAgo,
  type Confession,
  type ReactionCounts,
  type ReactionKey,
} from "@/lib/constants";

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
  onVote,
  myReaction,
  onReact,
  reported,
  onReported,
}: {
  confession: Confession;
  isNew: boolean;
  index: number;
  loggedIn: boolean;
  onNeedLogin: () => void;
  myVote: Dir | null;
  onVote: (dir: Dir | null) => void;
  myReaction: ReactionKey | null;
  onReact: (key: ReactionKey | null) => void;
  reported: boolean;
  onReported: () => void;
}) {
  const [up, setUp] = useState(confession.upvotes);
  const [down, setDown] = useState(confession.downvotes);
  const [mine, setMine] = useState<Dir | null>(myVote);
  const [pop, setPop] = useState<Dir | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(confession.comment_count ?? 0);
  const [expanded, setExpanded] = useState(false);

  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>(confession.reaction_counts ?? {});
  const [myReact, setMyReact] = useState<ReactionKey | null>(myReaction);
  const [popReaction, setPopReaction] = useState<ReactionKey | null>(null);

  // One vote or reaction request at a time per card, so quick taps can't overlap and roll back in the wrong order.
  const voting = useRef(false);
  const reacting = useRef(false);

  useEffect(() => {
    setMyReact(myReaction);
  }, [myReaction]);

  useEffect(() => {
    if (!reacting.current) setReactionCounts(confession.reaction_counts ?? {});
  }, [confession.reaction_counts]);

  // The account's saved vote loads after the feed does, and clears on log out.
  useEffect(() => {
    setMine(myVote);
  }, [myVote]);

  // Fresh counts arrive when the feed reloads.
  useEffect(() => {
    if (!voting.current) {
      setUp(confession.upvotes);
      setDown(confession.downvotes);
    }
  }, [confession.upvotes, confession.downvotes]);

  useEffect(() => {
    setCommentCount(confession.comment_count ?? 0);
  }, [confession.comment_count]);

  const category = CATEGORIES.find((c) => c.name === confession.category);
  const style = CATEGORY_STYLES[confession.category] ?? { bg: "#F0F0F0", text: "#555555" };
  const long = confession.content.length > LONG;
  const hot = up - down >= HOT_SCORE;
  const campusName = CAMPUS_SHORT[confession.campus] ?? confession.campus;

  async function report() {
    if (!loggedIn) return onNeedLogin();
    if (reported) return;
    if (!window.confirm("Report this post as harmful or inappropriate?")) return;
    // Only show "Reported" once the server has accepted it.
    const { error } = await supabase.rpc("report_confession", { p_id: confession.id });
    if (error) return window.alert("Couldn't send your report. Please try again.");
    onReported();
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
    if (voting.current) return;
    voting.current = true;
    const prev = mine;
    const next = prev === dir ? null : dir;
    shift(prev, next);
    setMine(next);
    if (next) {
      setPop(next);
      setTimeout(() => setPop(null), 400);
    }
    const { error } = await supabase.rpc("vote_confession", { p_id: confession.id, p_direction: next });
    voting.current = false;
    if (error) {
      shift(next, prev);
      setMine(prev);
    } else {
      onVote(next);
    }
  }

  // Moves this account's reaction from `from` to `to` in the on-screen counts.
  function shiftReaction(from: ReactionKey | null, to: ReactionKey | null) {
    setReactionCounts((counts) => {
      const next = { ...counts };
      if (from) next[from] = Math.max((next[from] ?? 0) - 1, 0);
      if (to) next[to] = (next[to] ?? 0) + 1;
      return next;
    });
  }

  // One reaction per account: tapping the same one again removes it; tapping another switches it.
  async function react(key: ReactionKey) {
    if (!loggedIn) return onNeedLogin();
    if (reacting.current) return;
    reacting.current = true;
    const prev = myReact;
    const next = prev === key ? null : key;
    shiftReaction(prev, next);
    setMyReact(next);
    if (next) {
      setPopReaction(next);
      setTimeout(() => setPopReaction(null), 400);
    }
    const { error } = await supabase.rpc("react_confession", { p_id: confession.id, p_reaction: next });
    reacting.current = false;
    if (error) {
      shiftReaction(next, prev);
      setMyReact(prev);
    } else {
      onReact(next);
    }
  }

  const voteButton = (dir: Dir, count: number) => {
    const active = mine === dir;
    const color = active ? (dir === "up" ? "text-accent-dark" : "text-hot") : "text-muted hover:text-ink";
    return (
      <button
        onClick={() => vote(dir)}
        aria-pressed={active}
        aria-label={dir === "up" ? "Upvote" : "Downvote"}
        className={`flex items-center gap-1.5 text-sm font-medium transition active:scale-90 ${color}`}
      >
        <svg
          viewBox="0 0 20 20"
          className={`h-[18px] w-[18px] ${dir === "down" ? "rotate-180" : ""} ${pop === dir ? "animate-pop" : ""}`}
          fill={active ? "currentColor" : "none"}
          aria-hidden="true"
        >
          <path
            d="M10 4v12M4.5 9.5 10 4l5.5 5.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="tabular-nums">{count}</span>
      </button>
    );
  };

  return (
    <article
      style={{ animationDelay: isNew ? undefined : `${Math.min(index, 8) * 40}ms` }}
      className={`rounded-2xl border border-line bg-white p-4 shadow-sm ${isNew ? "animate-slide-down" : "animate-fade-up"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            style={{ backgroundColor: style.bg, color: style.text }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
          >
            <span aria-hidden="true">{category?.emoji}</span>
            {confession.category}
          </span>
          {hot && (
            <span className="inline-flex items-center rounded-full bg-hot/10 px-2.5 py-1 text-xs font-semibold text-hot">
              🔥 Hot
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted">
          {campusName} · {timeAgo(confession.created_at)}
        </span>
      </div>

      <div className={`relative mt-3 ${long && !expanded ? "max-h-40 overflow-hidden" : ""}`}>
        <p className="whitespace-pre-wrap break-words text-[16px] leading-6 text-ink">{confession.content}</p>
        {long && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent" />
        )}
      </div>
      {long && (
        <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-sm font-medium text-accent-dark">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
        {REACTIONS.map((r) => {
          const n = reactionCounts[r.key] ?? 0;
          const active = myReact === r.key;
          return (
            <button
              key={r.key}
              onClick={() => react(r.key)}
              aria-pressed={active}
              aria-label={`${r.label} reaction`}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition active:scale-90 ${
                active ? "border-accent bg-accent/10 text-ink" : `border-[#eaeaea] bg-white ${n > 0 ? "text-ink" : "text-muted"}`
              }`}
            >
              <span className={`inline-block ${popReaction === r.key ? "animate-pop" : ""} ${n === 0 && !active ? "opacity-60" : ""}`}>
                {r.emoji}
              </span>
              {n > 0 && <span className="text-xs font-semibold tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-5 border-t border-line pt-3">
        {voteButton("up", up)}
        {voteButton("down", down)}
        <button
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          aria-label="Replies"
          className={`flex items-center gap-1.5 text-sm font-medium transition active:scale-95 ${
            showComments ? "text-ink" : "text-muted hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
            <path
              d="M10 3.5c-3.6 0-6.5 2.5-6.5 5.6 0 1.7.9 3.2 2.3 4.2L5 16.5l3.3-1.5c.5.1 1.1.2 1.7.2 3.6 0 6.5-2.5 6.5-5.6S13.6 3.5 10 3.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span className="tabular-nums">{commentCount}</span>
        </button>
        <span className="ml-auto flex items-center gap-2">
          <ShareImageButton url={`/api/card/${confession.id}`} filename="whispa-confession.png" />
          <ShareLink campus={confession.campus} content={confession.content} />
        </span>
      </div>

      <button
        onClick={report}
        disabled={reported}
        className="mt-2 text-[11px] text-[#aaa] transition hover:text-muted disabled:hover:text-[#aaa]"
      >
        {reported ? "Reported. Thanks." : "🚩 Report"}
      </button>

      {showComments && <Comments confessionId={confession.id} onAdded={() => setCommentCount((n) => n + 1)} />}
    </article>
  );
}
