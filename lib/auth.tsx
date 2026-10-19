"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const MIN_PASSWORD = 8;

// Supabase Auth is email-based, so each username maps to an internal address that never receives mail.
const toEmail = (username: string) => `${username.trim().toLowerCase()}@users.whispa.invalid`;

type AuthContextValue = {
  session: Session | null;
  username: string | null;
  ready: boolean;
  signIn: (username: string, password: string) => Promise<string | null>;
  signUp: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password });
    if (!error) return null;
    return error.message.toLowerCase().includes("invalid login")
      ? "Wrong username or password."
      : "Couldn't log in. Try again.";
  }, []);

  const signUp = useCallback(async (username: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: toEmail(username),
      password,
      options: { data: { username: username.trim().toLowerCase() } },
    });
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already registered") || m.includes("already been registered")) return "That username is taken.";
      if (m.includes("password")) return `Password must be at least ${MIN_PASSWORD} characters.`;
      return "Couldn't create your account. Try again.";
    }
    // No session means the project still requires email confirmation, which username accounts can't do.
    if (!data.session) return "Sign-ups are not open yet. Please try again later.";
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      username: (session?.user.user_metadata?.username as string | undefined) ?? null,
      ready,
      signIn,
      signUp,
      signOut,
    }),
    [session, ready, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
