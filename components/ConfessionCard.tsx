"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Comments from "./Comments";
import { CATEGORIES, timeAgo, whatsappLink, type Confession } from "@/lib/constants";

type Dir = "up" | "down";
const KEY = "whispa_votes";

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

const REPORT_KEY = "whispa_reported";

function readReported(): string[] {
  try {
    return JSON.parse(localStorage.getItem(REPORT_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function ConfessionCard({ confession }: { confession: Confession }) {
  const [up, setUp] = useState(confession.upvotes);
  const [down, setDown] = useState(confession.downvotes);
  const [mine, setMine] = useState<Dir | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(confession.comments?.[0]?.count ?? 0);

  const [reported, setReported] = useState(false);

  useEffect(() => {
    setMine(readVotes()[confession.id] ?? null);
    setReported(readReported().includes(confession.id));
  }, [confession.id]);

  async function report() {
    if (reported) return;
    if (!window.confirm("Report this post as harmful or inappropriate?")) return;
    setReported(true);
    try {
      localStorage.setItem(REPORT_KEY, JSON.stringify([...readReported(), confession.id]));
    } catch {}
    await supabase.rpc("report_confession", { p_id: confession.id });
  }

  const emoji = CATEGORIES.find((c) => c.name === confession.category)?.emoji ?? "";

  async function rpc(column: Dir, delta: 1 | -1) {
    await supabase.rpc("vote_confession", { p_id: confession.id, p_column: column, p_delta: delta });
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
    }
    writeVotes(votes);
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-[#141414] p-4">
      <p className="whitespace-pre-wrap break-words text-white">{confession.content}</p>
      <p className="mt-3 text-sm text-gray-400">
        {confession.campus} · {emoji} {confession.category} · {timeAgo(confession.created_at)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => vote("up")}
          aria-pressed={mine === "up"}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            mine === "up" ? "border-ghana bg-ghana/30 text-white" : "border-white/15 text-gray-300"
          }`}
        >
          👍 {up}
        </button>
        <button
          onClick={() => vote("down")}
          aria-pressed={mine === "down"}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            mine === "down" ? "border-red-500 bg-red-500/20 text-white" : "border-white/15 text-gray-300"
          }`}
        >
          👎 {down}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-gray-300"
        >
          💬 {commentCount}
        </button>
        <a
          href={whatsappLink(confession.campus, confession.content)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#25D366]/40 px-3 py-1.5 text-sm text-[#25D366]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#25D366]" aria-hidden="true">
            <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.78c-1.77 0-3.5-.48-5.01-1.37l-.36-.21-3.72.98 1-3.62-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.9 9.88M20.52 3.45A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.43-8.46" />
          </svg>
          Share on WhatsApp 💬
        </a>
      </div>
      <button
        onClick={report}
        disabled={reported}
        className="mt-2 text-xs text-gray-500 underline-offset-2 hover:underline disabled:no-underline"
      >
        {reported ? "Reported. Thanks." : "🚩 Report"}
      </button>
      {showComments &&<Comments confessionId={confession.id} onAdded={() => setCommentCount((n) => n + 1)} />}
    </article>
  );
}
