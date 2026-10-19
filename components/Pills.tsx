"use client";

import { CAMPUS_SHORT } from "@/lib/constants";

export const ALL = "All";
// Order shown in the filter row. "All" first, then each campus.
export const PILL_OPTIONS = [ALL, "ATU", "UG Legon", "KNUST", "UCC", "Ashesi", "UPSA", "GCTU", "Other"];
export const shortName = (c: string) => CAMPUS_SHORT[c] ?? c;

export default function Pills({ value, onChange }: { value: string; onChange: (campus: string) => void }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
      {PILL_OPTIONS.map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            aria-pressed={active}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              active ? "border-accent bg-accent text-white" : "border-[#eaeaea] bg-white text-[#555] hover:border-[#d8d8d8]"
            }`}
          >
            {shortName(c)}
          </button>
        );
      })}
    </div>
  );
}
