"use client";

import { useState } from "react";

function download(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "whispa-confession.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Builds the confession's image card, then opens the phone's share sheet with it
// (WhatsApp Status, class groups, etc.). Where sharing files isn't possible, it downloads the picture.
export default function ShareImageButton({ confessionId }: { confessionId: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/card/${confessionId}`);
      if (!res.ok) throw new Error("card");
      const blob = await res.blob();
      const file = new File([blob], "whispa-confession.png", { type: "image/png" });

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch (err) {
          // Closing the share sheet is not a failure.
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Some phones refuse to share once the image took a few seconds to build. Save it instead.
          download(blob);
        }
      } else {
        download(blob);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={share}
      disabled={busy}
      aria-label="Share as image"
      title={failed ? "Couldn't make the image. Tap to try again." : "Share as image"}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-50 ${
        failed ? "text-hot" : "text-muted hover:text-ink"
      }`}
    >
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-transparent" aria-hidden="true" />
      ) : (
        <svg viewBox="0 0 20 20" className="h-[19px] w-[19px]" fill="none" aria-hidden="true">
          <rect x="3" y="3.5" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="7.5" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.4" />
          <path d="m3.5 14.5 4-3.8 3 2.6 2.3-2 3.7 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
