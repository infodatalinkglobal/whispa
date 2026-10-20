import type { Confession } from "./constants";

// How fast posts fade. Higher means old posts sink sooner. 1.5 is the value Hacker News uses.
const GRAVITY = 1.5;
// A reply means people are talking, so it counts for more than a single vote or reaction.
const REPLY_WEIGHT = 2;

function reactionTotal(c: Confession): number {
  return Object.values(c.reaction_counts ?? {}).reduce((sum, n) => sum + (n ?? 0), 0);
}

// Hot score = (upvotes - downvotes + reactions + 2 * replies + 1) / (age in hours + 2) ^ 1.5
//  - The +1 and the +2 hours give a brand-new post a head start, so it isn't buried before anyone sees it.
//  - A post with more downvotes than upvotes gets a negative score and sinks to the bottom.
export function hotScore(c: Confession, now: number = Date.now()): number {
  const ageHours = Math.max(0, (now - new Date(c.created_at).getTime()) / 3_600_000);
  const points = c.upvotes - c.downvotes + reactionTotal(c) + REPLY_WEIGHT * (c.comment_count ?? 0) + 1;
  return points / Math.pow(ageHours + 2, GRAVITY);
}

// Highest score first; equal scores keep newest first.
export function rankHot(items: Confession[], now: number = Date.now()): Confession[] {
  return items
    .map((c) => ({ c, score: hotScore(c, now), time: new Date(c.created_at).getTime() }))
    .sort((a, b) => b.score - a.score || b.time - a.time)
    .map((x) => x.c);
}
