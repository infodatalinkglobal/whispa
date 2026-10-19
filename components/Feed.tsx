"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { CAMPUSES, CAMPUS_SHORT, type Confession } from "@/lib/constants";
import ConfessionCard from "./ConfessionCard";
import ConfessionForm from "./ConfessionForm";

const ALL = "All";
const CAMPUS_KEY = "whispa_campus";
const FILTERS = ["ATU", "UG Legon", "KNUST", "UCC", "Ashesi", "UPSA", ALL];
const short = (c: string) => CAMPUS_SHORT[c] ?? c;

type Menu = null | "campus" | "user";

export default function Feed() {
  const router = useRouter();
  const { session, username, signOut } = useAuth();
  const loggedIn = !!session;

  const [items, setItems] = useState<Confession[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [campus, setCampus] = useState<string>(ALL);
  const [ready, setReady] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [myVotes, setMyVotes] = useState<Record<string, "up" | "down">>({});
  const [myReports, setMyReports] = useState<Set<string>>(new Set());
  const known = useRef<Set<string> | null>(null);

  const goLogin = useCallback(() => router.push("/login"), [router]);

  // Remember the last campus this device picked.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CAMPUS_KEY);
      if (saved && (saved === ALL || (CAMPUSES as readonly string[]).includes(saved))) setCampus(saved);
    } catch {}
    setReady(true);
  }, []);

  // This account's own votes and reports (private to the account).
  useEffect(() => {
    if (!session) {
      setMyVotes({});
      setMyReports(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const [v, r] = await Promise.all([
        supabase.from("votes").select("confession_id, direction"),
        supabase.from("reports").select("confession_id"),
      ]);
      if (cancelled) return;
      const votes: Record<string, "up" | "down"> = {};
      (v.data ?? []).forEach((row) => (votes[row.confession_id] = row.direction as "up" | "down"));
      setMyVotes(votes);
      setMyReports(new Set((r.data ?? []).map((row) => row.confession_id as string)));
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const load = useCallback(
    async (markNew: boolean) => {
      let q = supabase
        .from("confessions")
        .select("id, content, campus, category, upvotes, downvotes, created_at, comment_count")
        .eq("is_approved", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (campus !== ALL) q = q.eq("campus", campus);
      const { data, error } = await q;
      if (error) return setError(true);
      const rows = data as Confession[];
      setError(false);
      if (markNew && known.current) {
        const prev = known.current;
        setFresh(new Set(rows.filter((r) => !prev.has(r.id)).map((r) => r.id)));
      }
      known.current = new Set(rows.map((r) => r.id));
      setItems(rows);
    },
    [campus]
  );

  useEffect(() => {
    if (!ready) return;
    known.current = null;
    setItems(null);
    setFresh(new Set());
    load(false);
  }, [load, ready]);

  function pick(c: string) {
    setCampus(c);
    setMenu(null);
    try {
      localStorage.setItem(CAMPUS_KEY, c);
    } catch {}
  }

  function startPost() {
    if (!loggedIn) return goLogin();
    setOpen(true);
  }

  const toggle = (m: Exclude<Menu, null>) => setMenu((cur) => (cur === m ? null : m));

  return (
    <>
      <div className="sticky top-0 z-30 bg-gradient-to-b from-base via-base/90 to-transparent pb-1 pt-3 backdrop-blur-md">
        <div className="mx-auto max-w-xl px-3">
          <div className="relative flex h-16 items-center justify-between gap-2 rounded-full border border-line border-b-accent/70 bg-card/80 pl-5 pr-3 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="min-w-0">
              <h1 className="font-display text-[26px] font-bold italic leading-none tracking-tight text-ink">
                Whispa <span className="text-xl not-italic">🤫</span>
              </h1>
              <p className="mt-1 text-[11px] text-muted">Say it. Nobody knows.</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => toggle("campus")}
                aria-haspopup="listbox"
                aria-expanded={menu === "campus"}
                className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-sm font-semibold text-accent transition active:scale-95"
              >
                {short(campus)}
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                  <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              </button>

              <button
                onClick={() => (loggedIn ? toggle("user") : goLogin())}
                aria-label={loggedIn ? "Account menu" : "Log in"}
                aria-haspopup={loggedIn ? "menu" : undefined}
                aria-expanded={loggedIn ? menu === "user" : undefined}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition active:scale-95 ${
                  loggedIn ? "border-accent bg-accent text-[#04140b]" : "border-line text-muted hover:text-ink"
                }`}
              >
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

            {menu && <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />}

            {menu === "campus" && (
              <ul
                role="listbox"
                className="absolute right-2 top-[72px] z-20 w-44 animate-fade-in rounded-2xl border border-line bg-card p-1.5 shadow-2xl shadow-black"
              >
                {[ALL, ...CAMPUSES].map((c) => (
                  <li key={c}>
                    <button
                      role="option"
                      aria-selected={campus === c}
                      onClick={() => pick(c)}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                        campus === c ? "bg-accent/15 text-accent" : "text-ink hover:bg-white/5"
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
                className="absolute right-2 top-[72px] z-20 w-52 animate-fade-in rounded-2xl border border-line bg-card p-1.5 shadow-2xl shadow-black"
              >
                <p className="px-3 pb-1 pt-2 text-xs text-muted">Signed in as</p>
                <p className="truncate px-3 pb-2 text-sm font-semibold text-ink">@{username}</p>
                <button
                  role="menuitem"
                  onClick={async () => {
                    setMenu(null);
                    await signOut();
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-hot hover:bg-white/5"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="no-scrollbar mx-auto flex max-w-xl gap-2 overflow-x-auto px-4 py-3">
            {FILTERS.map((c) => (
              <button
                key={c}
                onClick={() => pick(c)}
                aria-pressed={campus === c}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  campus === c
                    ? "border-accent bg-accent text-[#04140b]"
                    : "border-line bg-transparent text-muted hover:text-ink"
                }`}
              >
                {short(c)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 pb-32 pt-5">
        {error && (
          <p className="py-10 text-center text-sm text-hot">Couldn&apos;t load confessions. Check your connection and try again.</p>
        )}

        {!error && items === null && (
          <div className="space-y-4" aria-label="Loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-line bg-card" />
            ))}
          </div>
        )}

        {items && items.length === 0 && (
          <div className="animate-fade-up py-20 text-center">
            <div className="text-6xl">🤫</div>
            <p className="mt-5 font-display text-xl font-semibold text-ink">No confessions yet. Be the first.</p>
            <p className="mt-1 text-sm text-muted">Your secret is safe here.</p>
          </div>
        )}

        <div className="space-y-4">
          {items?.map((c, i) => (
            <ConfessionCard
              key={c.id}
              confession={c}
              isNew={fresh.has(c.id)}
              index={i}
              loggedIn={loggedIn}
              onNeedLogin={goLogin}
              myVote={myVotes[c.id] ?? null}
              reported={myReports.has(c.id)}
              onReported={() => setMyReports((s) => new Set(s).add(c.id))}
            />
          ))}
        </div>
      </div>

      <button
        onClick={startPost}
        className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-accent px-7 py-3.5 font-display text-base font-bold text-[#04140b] shadow-[0_0_36px_rgba(0,197,102,0.45)] transition active:scale-95"
      >
        🤫 Whispa
      </button>

      {open && (
        <ConfessionForm
          onClose={() => setOpen(false)}
          onPosted={() => {
            setOpen(false);
            load(true);
          }}
        />
      )}
    </>
  );
}
