"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MIN_PASSWORD, USERNAME_RE, useAuth } from "@/lib/auth";
import { CAMPUSES, CAMPUS_SHORT } from "@/lib/constants";
import { generateRecoveryCode } from "@/lib/recovery";
import RecoveryCodeCard from "./RecoveryCodeCard";

type Mode = "login" | "signup";
const CAMPUS_KEY = "whispa_campus";

export default function LoginForm() {
  const router = useRouter();
  const { session, ready, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [campus, setCampus] = useState<string>("ATU");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codeToShow, setCodeToShow] = useState<string | null>(null);
  // Stops the "already logged in" redirect while the new member is saving their recovery code.
  const holdRedirect = useRef(false);

  useEffect(() => {
    if (ready && session && !holdRedirect.current) router.replace("/");
  }, [ready, session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!USERNAME_RE.test(username.trim())) {
      return setError("Username must be 3 to 20 letters, numbers or underscores.");
    }
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    }
    if (!password) return setError("Enter your password.");

    setBusy(true);
    if (mode === "login") {
      const err = await signIn(username, password);
      setBusy(false);
      if (err) return setError(err);
      return router.replace("/");
    }

    holdRedirect.current = true;
    const err = await signUp(username, password);
    if (err) {
      holdRedirect.current = false;
      setBusy(false);
      return setError(err);
    }
    // New members land on their own campus feed.
    try {
      localStorage.setItem(CAMPUS_KEY, campus);
    } catch {}

    const code = generateRecoveryCode();
    const { error: codeError } = await supabase.rpc("set_recovery_code", { p_code: code });
    setBusy(false);
    if (codeError) {
      // The account exists; the member can create a recovery code later from the account menu.
      holdRedirect.current = false;
      return router.replace("/");
    }
    setCodeToShow(code);
  }

  const field =
    "w-full rounded-full border border-line bg-card px-6 py-4 text-[17px] text-ink outline-none transition placeholder:text-muted focus:border-accent";

  if (codeToShow) {
    return (
      <div className="w-full max-w-sm">
        <RecoveryCodeCard
          code={codeToShow}
          actionLabel="Continue to Whispa"
          onDone={() => {
            holdRedirect.current = false;
            router.replace("/");
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm animate-fade-up">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/25 blur-[90px]"
      />

      <div className="relative">
        <p className="font-display text-lg font-bold italic text-ink">
          Whispa <span className="not-italic">🤫</span>
        </p>

        <h1 className="mt-6 font-display text-[44px] font-bold leading-[1.02] tracking-tight text-ink">
          {mode === "signup" ? (
            <>
              Join your
              <br />
              <span className="text-accent">campus.</span>
            </>
          ) : (
            <>
              Welcome
              <br />
              <span className="text-accent">back.</span>
            </>
          )}
        </h1>
        <p className="mt-3 text-[17px] leading-snug text-muted">
          {mode === "signup"
            ? "Real confessions. No names. Pick a username and you're in."
            : "Log in to post, vote and reply."}
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

          <div className="relative">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={show ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? `Password (${MIN_PASSWORD}+ characters)` : "Password"}
              aria-label="Password"
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

          {mode === "signup" && (
            <div className="pt-2">
              <p className="mb-2 px-1 text-sm font-medium text-muted">Which campus are you at?</p>
              <div className="flex flex-wrap gap-2">
                {CAMPUSES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={campus === c}
                    onClick={() => setCampus(c)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95 ${
                      campus === c
                        ? "border-accent bg-accent text-[#04140b]"
                        : "border-line bg-card text-muted hover:text-ink"
                    }`}
                  >
                    {CAMPUS_SHORT[c] ?? c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "login" && (
            <p className="px-2 text-right text-sm">
              <Link href="/reset" className="text-muted hover:text-accent">
                Forgot password?
              </Link>
            </p>
          )}

          {error && (
            <p role="alert" className="px-1 text-sm text-hot">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-full bg-accent py-4 font-display text-lg font-bold text-[#04140b] shadow-[0_0_36px_rgba(0,197,102,0.4)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-[15px] text-muted">
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
            }}
            className="font-semibold text-accent hover:underline"
          >
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </p>

        {mode === "signup" && (
          <p className="mt-4 text-center text-xs leading-relaxed text-muted">
            No email needed. Your username is never shown on your confessions, votes or replies. Keep your password
            safe, because we can&apos;t reset it.
          </p>
        )}

        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-muted hover:text-ink">
            Just browsing? <span className="text-accent">See the feed</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
