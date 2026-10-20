// Helpers for anonymous messages. Senders have no account, so each message gets a random secret kept in
// their own browser. They use it to see replies later, on the same phone and browser.

export type SentMessage = { token: string; content: string; at: number };

const KEY = (code: string) => `whispa_sent:${code.toLowerCase()}`;
const MAX_REMEMBERED = 20;

// 128 random bits as 32 hex characters.
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function readSent(code: string): SentMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY(code)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rememberSent(code: string, message: SentMessage): SentMessage[] {
  const next = [message, ...readSent(code)].slice(0, MAX_REMEMBERED);
  try {
    localStorage.setItem(KEY(code), JSON.stringify(next));
  } catch {}
  return next;
}

// Private link someone shares to receive messages.
export function inboxLink(code: string, base: string): string {
  return `${base.replace(/\/$/, "")}/m/${code}`;
}

export function inboxShareLink(link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`Send me an anonymous message 🤫\n${link}`)}`;
}

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
