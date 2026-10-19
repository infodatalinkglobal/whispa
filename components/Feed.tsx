"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CAMPUSES, CAMPUS_SHORT, type Confession } from "@/lib/constants";
import ConfessionCard from "./ConfessionCard";
import ConfessionForm from "./ConfessionForm";

const ALL = "All";
const CAMPUS_KEY = "whispa_campus";
const FILTERS = ["ATU", "UG Legon", "KNUST", "UCC", "Ashesi", "UPSA", ALL];
const short = (c: string) => CAMPUS_SHORT[c] ?? c;

export default function Feed() {
  const [items, setItems] = useState<Confession[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [campus, setCampus] = useState<string>(ALL);
  const [ready, setReady] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const known = useRef<Set<string> | null>(null);

  // Remember the last campus this device picked.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CAMPUS_KEY);
      if (saved && (saved === ALL || (CAMPUSES as readonly string[]).includes(saved))) setCampus(saved);
    } catch {}
    setReady(true);
  }, []);

  const load = useCallback(
    async (markNew: boolean) => {
      let q = supabase
        .from("confessions")
        .select("id, content, campus, category, upvotes, downvotes, created_at, comments(count)")
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
    setMenu(false);
    try {
      localStorage.setItem(CAMPUS_KEY, c);
    } catch {}
  }

  return (
    <>
      <div className="sticky top-0 z-30 bg-base/75 backdrop-blur-xl">
        <div className="border-b border-accent/60">
          <div className="relative mx-auto flex h-16 max-w-xl items-center justify-between px-4">
            <div>
              <h1 className="font-display text-[26px] font-bold italic leading-none tracking-tight text-ink">
                Whispa <span className="text-xl not-italic">🤫</span>
              </h1>
              <p className="mt-1 text-[11px] text-muted">Say it. Nobody knows.</p>
            </div>

            <button
              onClick={() => setMenu((m) => !m)}
              aria-haspopup="listbox"
              aria-expanded={menu}
              className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-sm font-semibold text-accent transition active:scale-95"
            >
              {short(campus)}
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </button>

            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <ul
                  role="listbox"
                  className="absolute right-4 top-14 z-20 w-44 animate-fade-in rounded-2xl border border-line bg-card p-1.5 shadow-2xl shadow-black"
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
              </>
            )}
          </div>
        </div>

        <div className="border-b border-line">
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
            <ConfessionCard key={c.id} confession={c} isNew={fresh.has(c.id)} index={i} />
          ))}
        </div>
      </div>

      <button
        onClick={() => setOpen(true)}
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
