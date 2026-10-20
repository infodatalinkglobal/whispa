"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ACTIVE_CAMPUSES, SINGLE_CAMPUS } from "@/lib/constants";
import { ALL, PILL_OPTIONS, shortName } from "./Pills";

type Menu = null | "campus" | "user";

export default function Header({
  campus,
  onPickCampus,
  loggedIn,
  username,
  onLogin,
  onSignOut,
  onNewCode,
  unread = 0,
}: {
  campus: string;
  onPickCampus: (campus: string) => void;
  loggedIn: boolean;
  username: string | null;
  onLogin: () => void;
  onSignOut: () => void;
  onNewCode: () => void;
  // Unread anonymous messages in the account's inbox.
  unread?: number;
}) {
  const [menu, setMenu] = useState<Menu>(null);
  const toggle = (m: Exclude<Menu, null>) => setMenu((cur) => (cur === m ? null : m));
  const close = () => setMenu(null);
  const root = useRef<HTMLDivElement>(null);

  // Close an open menu when the student taps anywhere else or presses Escape. (A full-screen overlay
  // doesn't work here: the blurred sticky header would clip it to the header's own height.)
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <div ref={root} className="relative mx-auto flex h-14 max-w-[560px] items-center justify-between px-4">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink">
        Whispa <span className="text-lg">🤫</span>
      </h1>

      <div className="flex items-center gap-2">
        {SINGLE_CAMPUS ? (
          // One campus open: show it as a plain label, not a picker.
          <span className="rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-sm font-semibold text-accent-dark">
            {shortName(ACTIVE_CAMPUSES[0])}
          </span>
        ) : (
          <button
            onClick={() => toggle("campus")}
            aria-haspopup="listbox"
            aria-expanded={menu === "campus"}
            className="flex items-center gap-1 rounded-full border border-[#eaeaea] bg-white px-3.5 py-1.5 text-sm font-medium text-ink transition active:scale-95"
          >
            {campus === ALL ? "All campuses" : shortName(campus)}
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-muted" fill="none" aria-hidden="true">
              <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <button
          onClick={() => (loggedIn ? toggle("user") : onLogin())}
          aria-label={loggedIn ? "Account menu" : "Log in"}
          aria-haspopup={loggedIn ? "menu" : undefined}
          aria-expanded={loggedIn ? menu === "user" : undefined}
          className={`relative flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition active:scale-95 ${
            loggedIn ? "border-accent bg-accent text-white" : "border-[#eaeaea] text-muted hover:text-ink"
          }`}
        >
          {loggedIn && unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-hot"
              aria-label={`${unread} unread messages`}
            />
          )}
          {loggedIn ? (
            (username ?? "?").charAt(0).toUpperCase()
          ) : (
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
              <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3.8 16.5c.6-3 3-4.6 6.2-4.6s5.6 1.6 6.2 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {menu === "campus" && (
        <ul
          role="listbox"
          className="absolute right-4 top-[52px] z-20 w-44 animate-fade-in rounded-2xl border border-line bg-white p-1.5 shadow-lg"
        >
          {PILL_OPTIONS.map((c) => (
            <li key={c}>
              <button
                role="option"
                aria-selected={campus === c}
                onClick={() => {
                  onPickCampus(c);
                  close();
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                  campus === c ? "bg-accent/10 font-semibold text-accent-dark" : "text-ink hover:bg-soft"
                }`}
              >
                {c === ALL ? "All campuses" : c}
              </button>
            </li>
          ))}
        </ul>
      )}

      {menu === "user" && loggedIn && (
        <div
          role="menu"
          className="absolute right-4 top-[52px] z-20 w-52 animate-fade-in rounded-2xl border border-line bg-white p-1.5 shadow-lg"
        >
          <p className="px-3 pb-1 pt-2 text-xs text-muted">Signed in as</p>
          <p className="truncate px-3 pb-2 text-sm font-semibold text-ink">@{username}</p>
          <Link
            role="menuitem"
            href="/inbox"
            onClick={close}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-soft"
          >
            <span>💌 My inbox</span>
            {unread > 0 && (
              <span className="rounded-full bg-hot px-2 py-0.5 text-xs font-bold tabular-nums text-white">{unread}</span>
            )}
          </Link>
          <button
            role="menuitem"
            onClick={() => {
              close();
              onNewCode();
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-soft"
          >
            New recovery code
          </button>
          <button
            role="menuitem"
            onClick={() => {
              close();
              onSignOut();
            }}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-hot hover:bg-soft"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
