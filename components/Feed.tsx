"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Confession } from "@/lib/constants";
import ConfessionCard from "./ConfessionCard";
import ConfessionForm from "./ConfessionForm";

export default function Feed() {
  const [items, setItems] = useState<Confession[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("confessions")
      .select("id, content, campus, category, upvotes, downvotes, created_at")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setError(true);
    else {
      setError(false);
      setItems(data as Confession[]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      {error && <p className="text-center text-red-400">Couldn&apos;t load confessions. Try again.</p>}
      {!error && items === null && <p className="text-center text-gray-500">Loading…</p>}
      {items && items.length === 0 && (
        <p className="text-center text-gray-500">No confessions yet. Be the first 🤫</p>
      )}
      <div className="space-y-4">
        {items?.map((c) => (
          <ConfessionCard key={c.id} confession={c} />
        ))}
      </div>

      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ghana px-6 py-3 font-semibold text-white shadow-lg shadow-black/60 active:scale-95"
      >
        + Whispa
      </button>

      {open && (
        <ConfessionForm
          onClose={() => setOpen(false)}
          onPosted={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </>
  );
}
