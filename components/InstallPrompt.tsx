"use client";

import { useEffect, useState } from "react";

// Chrome and Edge fire this event when the app can be installed.
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "whispa_install_dismissed";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

// Apps opened inside Instagram, Facebook etc. can't be installed from there.
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok/i;

function isIos(): boolean {
  const ua = navigator.userAgent;
  const iPad13 = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || iPad13;
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Asks first-time visitors to add Whispa to their home screen.
// Android/desktop Chrome: a one-tap Install button. iPhone: the Safari steps (iOS has no install button for sites).
export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    if (isInstalled() || IN_APP_BROWSER.test(navigator.userAgent)) return;
    try {
      if (Date.now() - Number(localStorage.getItem(DISMISSED_KEY) || 0) < SNOOZE_MS) return;
    } catch {}

    if (isIos()) setShowIos(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIos(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent && !showIos) return null;

  function dismiss() {
    setInstallEvent(null);
    setShowIos(false);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    // The browser only allows one prompt per event, so hide the banner either way.
    setInstallEvent(null);
  }

  return (
    <div role="region" aria-label="Install Whispa" className="mb-3 animate-fade-up rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl font-extrabold text-white"
          style={{ background: "linear-gradient(160deg, #00E680 0%, #00B85F 100%)" }}
        >
          W
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-ink">Install Whispa</p>
          {installEvent ? (
            <p className="mt-0.5 text-sm leading-snug text-muted">
              Add it to your home screen. It opens in one tap, like any other app.
            </p>
          ) : (
            <p className="mt-0.5 text-sm leading-snug text-muted">
              Tap{" "}
              <svg viewBox="0 0 20 20" className="-mt-0.5 inline h-4 w-4 text-[#007AFF]" fill="none" aria-label="Share">
                <path d="M10 12.5V3.5M6.8 6.5 10 3.3l3.2 3.2M5 9.5h-.5A1.5 1.5 0 0 0 3 11v5a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 17 16v-5a1.5 1.5 0 0 0-1.5-1.5H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>{" "}
              then <span className="font-semibold text-ink">Add to Home Screen</span>.
            </p>
          )}

          {installEvent && (
            <button
              onClick={install}
              className="mt-3 rounded-full bg-accent px-5 py-2 text-sm font-bold text-white shadow-[0_6px_18px_rgba(0,215,114,0.35)] transition active:scale-95"
            >
              Install
            </button>
          )}
        </div>

        <button
          onClick={dismiss}
          aria-label="Not now"
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted transition hover:bg-soft hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}
