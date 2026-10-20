export const CAMPUSES = ["ATU", "UG Legon", "KNUST", "UCC", "Ashesi", "UPSA", "GCTU", "Other"] as const;

// Campuses open for posting right now. With a single campus the app hides every campus choice.
// To open more campuses later, add them here and update the database insert policy to match.
export const ACTIVE_CAMPUSES: readonly string[] = ["ATU"];
export const SINGLE_CAMPUS = ACTIVE_CAMPUSES.length === 1;

export const CATEGORIES = [
  { name: "Relationships", emoji: "💔" },
  { name: "Academics", emoji: "📚" },
  { name: "Money", emoji: "💰" },
  { name: "Drama", emoji: "☕" },
  { name: "Work", emoji: "🔧" },
] as const;

// Soft pill colours per category.
export const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  Relationships: { bg: "#FFE4F0", text: "#C2185B" },
  Academics: { bg: "#E4F0FF", text: "#1565C0" },
  Money: { bg: "#E4FFF0", text: "#1B7F3A" },
  Drama: { bg: "#FFF4E4", text: "#B45309" },
  Work: { bg: "#F0E4FF", text: "#6D28D9" },
};

export const CAMPUS_SHORT: Record<string, string> = { "UG Legon": "Legon" };

// Emoji reactions. The key is what the database stores.
export const REACTIONS = [
  { key: "laugh", emoji: "😂", label: "Funny" },
  { key: "cry", emoji: "😭", label: "Relatable" },
  { key: "shy", emoji: "😳", label: "Wow" },
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "love", emoji: "❤️", label: "Love" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];
export type ReactionCounts = Partial<Record<ReactionKey, number>>;

export type Confession = {
  id: string;
  content: string;
  campus: string;
  category: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  comment_count?: number;
  reaction_counts?: ReactionCounts;
};

export type Comment = {
  id: string;
  content: string;
  created_at: string;
};

export function timeAgo(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const SHARE_LIMIT = 180;

export function truncate(text: string, max = SHARE_LIMIT): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`;
}

export function whatsappLink(campus: string, content: string, appUrl: string): string {
  const text = `👀 Someone at ${campus} confessed on Whispa 🤫\n\n“${truncate(content)}”\n\nRead more👇\n${appUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
