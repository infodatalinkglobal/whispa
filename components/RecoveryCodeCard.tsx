"use client";

import { useState } from "react";
import { formatRecoveryCode } from "@/lib/recovery";

export default function RecoveryCodeCard({
  code,
  actionLabel,
  onDone,
  busy = false,
  error = "",
}: {
  code: string;
  actionLabel: string;
  onDone: () => void;
  // Set while the parent is saving the code, and to show why saving failed.
  busy?: boolean;
  error?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const shown = formatRecoveryCode(code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="animate-fade-up">
      <h2 className="font-display text-[34px] font-bold leading-[1.05] tracking-tight text-ink">
        Save your
        <br />
        <span className="text-accent-dark">recovery code.</span>
      </h2>
      <p className="mt-3 text-[16px] leading-snug text-muted">
        If you forget your password, this code is the only way back into your account. There is no email reset.
        It&apos;s shown once.
      </p>

      <div className="mt-6 rounded-3xl border border-accent/40 bg-[#fafafa] p-5 text-center">
        <p className="select-all font-mono text-[22px] font-bold tracking-wider text-accent-dark">{shown}</p>
        <button
          type="button"
          onClick={copy}
          className="mt-4 rounded-full border border-line px-5 py-2 text-sm font-medium text-ink transition active:scale-95 hover:border-accent"
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
      </div>

      <p className="mt-4 text-sm leading-snug text-muted">
        Screenshot it or write it down somewhere only you can see. Anyone with this code can reset your password.
      </p>

      <label className="mt-5 flex cursor-pointer items-start gap-3 text-[15px] text-ink">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[#00D772]"
        />
        I&apos;ve saved my recovery code
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm text-hot">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!saved || busy}
        onClick={onDone}
        className="mt-5 w-full rounded-full bg-accent py-4 font-display text-lg font-bold text-white shadow-[0_8px_28px_rgba(0,215,114,0.4)] transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
      >
        {busy ? "Saving…" : actionLabel}
      </button>
    </div>
  );
}
