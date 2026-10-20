"use client";

import Link from "next/link";

// A small, always-there way into the inbox: get a link, share it, read what people send.
export default function InboxPromo({ unread = 0 }: { unread?: number }) {
  return (
    <Link
      href="/inbox"
      className="mb-3 flex w-full animate-fade-up items-center gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-sm transition active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-xl" aria-hidden="true">
        💌
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-ink">
          {unread > 0 ? `You have ${unread} new anonymous message${unread === 1 ? "" : "s"}` : "Get anonymous messages"}
        </span>
        <span className="block text-sm text-muted">
          {unread > 0 ? "Tap to read them." : "Share your link. Anyone can send you a message."}
        </span>
      </span>
      <span className="text-lg text-muted" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
