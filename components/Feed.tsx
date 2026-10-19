"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { ACTIVE_CAMPUSES, CAMPUSES, SINGLE_CAMPUS, type Confession } from "@/lib/constants";
import { generateRecoveryCode } from "@/lib/recovery";
import BottomSheet from "./BottomSheet";
import ConfessionCard from "./ConfessionCard";
import ConfessionForm from "./ConfessionForm";
import Header from "./Header";
import InstallPrompt from "./InstallPrompt";
import Pills, { ALL } from "./Pills";
import RecoveryCodeCard from "./RecoveryCodeCard";

const CAMPUS_KEY = "whispa_campus";

export default function Feed() {
  const router = useRouter();
  const { session, username, signOut } = useAuth();
  const loggedIn = !!session;

  const [items, setItems] = useState<Confession[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  // With one open campus the feed is locked to it; otherwise it starts on "All".
  const [campus, setCampus] = useState<string>(SINGLE_CAMPUS ? ACTIVE_CAMPUSES[0] : ALL);
  const [ready, setReady] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [myVotes, setMyVotes] = useState<Record<string, "up" | "down">>({});
  const [myReports, setMyReports] = useState<Set<string>>(new Set());
  const [newCode, setNewCode] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeSaveError, setCodeSaveError] = useState("");
  const known = useRef<Set<string> | null>(null);
  // Only the newest request may update the screen, so a slow older response can't overwrite fresher data.
  const requestId = useRef(0);
  const lastLoaded = useRef(0);

  const goLogin = useCallback(() => router.push("/login"), [router]);

  // Remember the last campus this device picked.
  useEffect(() => {
    if (SINGLE_CAMPUS) return setReady(true);
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
      const id = ++requestId.current;
      const { data, error } = await q;
      if (id !== requestId.current) return;
      if (error) return setError(true);
      lastLoaded.current = Date.now();
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

  // Other people's new posts show up when the student comes back to the tab (at most every 30 seconds).
  useEffect(() => {
    if (!ready) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoaded.current > 30_000) load(false);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load, ready]);

  function pick(c: string) {
    setCampus(c);
    try {
      localStorage.setItem(CAMPUS_KEY, c);
    } catch {}
  }

  // The new code is only saved once the member confirms they've kept it. Closing the sheet early
  // leaves the old code working, so nobody is locked out by a code they never saw.
  function makeRecoveryCode() {
    setCodeSaveError("");
    setNewCode(generateRecoveryCode());
  }

  async function saveNewCode() {
    if (!newCode) return;
    setCodeBusy(true);
    const { error } = await supabase.rpc("set_recovery_code", { p_code: newCode });
    setCodeBusy(false);
    if (error) return setCodeSaveError("Couldn't save your new code. Try again. Your old code still works.");
    setNewCode(null);
  }

  function startPost() {
    if (!loggedIn) return goLogin();
    setOpen(true);
  }

  const closeForm = useCallback(() => setOpen(false), []);
  const closeCode = useCallback(() => {
    setNewCode(null);
    setCodeSaveError("");
  }, []);

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md">
        <Header
          campus={campus}
          onPickCampus={pick}
          loggedIn={loggedIn}
          username={username}
          onLogin={goLogin}
          onSignOut={signOut}
          onNewCode={makeRecoveryCode}
        />
        {!SINGLE_CAMPUS && (
          <div className="mx-auto max-w-[560px]">
            <Pills value={campus} onChange={pick} />
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[560px] px-4 pb-32 pt-4">
        <InstallPrompt />

        {error && (
          <p className="py-10 text-center text-sm text-hot">Couldn&apos;t load confessions. Check your connection and try again.</p>
        )}

        {!error && items === null && (
          <div className="space-y-3" aria-label="Loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-soft" />
            ))}
          </div>
        )}

        {items && items.length === 0 && (
          <div className="animate-fade-up py-20 text-center">
            <div className="text-6xl">🤫</div>
            <p className="mt-5 text-xl font-bold text-ink">No confessions yet. Be the first.</p>
            <p className="mt-1 text-sm text-muted">Your secret is safe here.</p>
          </div>
        )}

        <div className="space-y-3">
          {items?.map((c, i) => (
            <ConfessionCard
              key={c.id}
              confession={c}
              isNew={fresh.has(c.id)}
              index={i}
              loggedIn={loggedIn}
              onNeedLogin={goLogin}
              myVote={myVotes[c.id] ?? null}
              onVote={(dir) =>
                setMyVotes((v) => {
                  const next = { ...v };
                  if (dir) next[c.id] = dir;
                  else delete next[c.id];
                  return next;
                })
              }
              reported={myReports.has(c.id)}
              onReported={() => setMyReports((s) => new Set(s).add(c.id))}
            />
          ))}
        </div>
      </div>

      <button
        onClick={startPost}
        className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-accent px-7 py-3.5 text-base font-bold text-white shadow-[0_8px_28px_rgba(0,215,114,0.45)] transition active:scale-95"
      >
        🤫 Whispa
      </button>

      {open && (
        <BottomSheet onClose={closeForm} title="New confession">
          <ConfessionForm
            onClose={closeForm}
            onPosted={() => {
              setOpen(false);
              load(true);
            }}
          />
        </BottomSheet>
      )}

      {newCode && (
        <BottomSheet onClose={closeCode} title="Recovery code">
          <RecoveryCodeCard code={newCode} actionLabel="Done" onDone={saveNewCode} busy={codeBusy} error={codeSaveError} />
        </BottomSheet>
      )}
    </>
  );
}
