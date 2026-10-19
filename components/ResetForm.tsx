"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { MIN_PASSWORD, USERNAME_RE } from "@/lib/auth";
import RecoveryCodeCard from "./RecoveryCodeCard";

export default function ResetForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!USERNAME_RE.test(username.trim())) return setError("Enter your username.");
    if (code.replace(/[^A-Za-z0-9]/g, "").length !== 16) return setError("Your recovery code has 16 letters and numbers.");
    if (password.length < MIN_PASSWORD) return setError(`New password must be at least ${MIN_PASSWORD} characters.`);

    setBusy(true);
    const { data, error: fnError } = await supabase.functions.invoke("reset-password", {
      body: { username: username.trim(), code, password },
    });
    setBusy(false);

    if (fnError || !data?.ok) {
      return setError("Wrong username or recovery code. After 5 wrong tries you'll need to wait 15 minutes.");
    }
    setNewCode(data.newCode as string);
  }

  const field =
    "w-full rounded-full border border-line bg-[#fafafa] px-6 py-4 text-[17px] text-ink outline-none transition placeholder:text-muted focus:border-accent";

  return (
    <div className="relative w-full max-w-sm animate-fade-up">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/25 blur-[90px]"
      />
      <div className="relative">
        <p className="font-display text-lg font-bold text-ink">
          Whispa <span className="not-italic">🤫</span>
        </p>

        {newCode ? (
          <div className="mt-6">
            <p className="mb-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-dark">
              Password changed. Your old recovery code no longer works, so save this new one.
            </p>
            <RecoveryCodeCard code={newCode} actionLabel="Go to log in" onDone={() => router.replace("/login")} />
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-[44px] font-bold leading-[1.02] tracking-tight text-ink">
              Reset your
              <br />
              <span className="text-accent-dark">password.</span>
            </h1>
            <p className="mt-3 text-[17px] leading-snug text-muted">
              Enter your username and the recovery code you saved when you signed up.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-3" noValidate>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={20}
                placeholder="Username"
                aria-label="Username"
                className={field}
              />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={19}
                placeholder="Recovery code"
                aria-label="Recovery code"
                className={`${field} font-mono tracking-wider`}
              />
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={`New password (${MIN_PASSWORD}+ characters)`}
                  aria-label="New password"
                  className={`${field} pr-20`}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted hover:text-ink"
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>

              {error && (
                <p role="alert" className="px-1 text-sm text-hot">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 w-full rounded-full bg-accent py-4 font-display text-lg font-bold text-white shadow-[0_8px_28px_rgba(0,215,114,0.4)] transition active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? "Please wait…" : "Reset password"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-relaxed text-muted">
              Lost your recovery code too? We can&apos;t verify who you are without an email, so the account can&apos;t be
              recovered. You can make a new one at any time.
            </p>

            <p className="mt-6 text-center text-sm">
              <Link href="/login" className="text-muted hover:text-ink">
                Back to <span className="text-accent-dark">log in</span>
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
