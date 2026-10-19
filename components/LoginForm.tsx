"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MIN_PASSWORD, USERNAME_RE, useAuth } from "@/lib/auth";

type Mode = "login" | "signup";

export default function LoginForm() {
  const router = useRouter();
  const { session, ready, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && session) router.replace("/");
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
    const err = mode === "login" ? await signIn(username, password) : await signUp(username, password);
    setBusy(false);
    if (err) return setError(err);
    router.replace("/");
  }

  const field =
    "w-full rounded-xl border border-line bg-base px-4 py-3.5 text-ink outline-none transition placeholder:text-muted focus:border-accent/60";

  return (
    <div className="w-full max-w-sm animate-fade-up">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-bold italic tracking-tight">
          Whispa <span className="not-italic">🤫</span>
        </h1>
        <p className="mt-2 text-sm text-muted">Say it. Nobody knows.</p>
      </div>

      <div className="rounded-3xl border border-line bg-card p-5">
        <div className="mb-5 grid grid-cols-2 rounded-full border border-line bg-base p-1" role="tablist">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`rounded-full py-2 text-sm font-semibold transition ${
                mode === m ? "bg-accent text-[#04140b]" : "text-muted hover:text-ink"
              }`}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              placeholder="e.g. kwame_21"
              className={field}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Password</span>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={show ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "signup" ? `At least ${MIN_PASSWORD} characters` : "Your password"}
                className={`${field} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted hover:text-ink"
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && (
            <p role="alert" className="text-sm text-hot">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-accent py-3.5 font-display text-base font-bold text-[#04140b] shadow-[0_0_28px_rgba(0,197,102,0.3)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        {mode === "signup" && (
          <p className="mt-4 text-center text-xs leading-relaxed text-muted">
            No email needed. Your username is never shown on your confessions, votes or replies.
            <br />
            Keep your password safe. We can&apos;t reset it.
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/" className="text-accent hover:underline">
          Browse without an account
        </Link>
      </p>
    </div>
  );
}
