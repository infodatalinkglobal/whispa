export const CAMPUSES = ["ATU", "UG Legon", "KNUST", "UCC", "Ashesi", "UPSA", "GCTU", "Other"] as const;

export const CATEGORIES = [
  { name: "Relationships", emoji: "💔" },
  { name: "Academics", emoji: "📚" },
  { name: "Money", emoji: "💰" },
  { name: "Drama", emoji: "☕" },
  { name: "Work", emoji: "🔧" },
] as const;

// Left-border colour per category, and the short campus names shown in the filter bar.
export const CATEGORY_COLORS: Record<string, string> = {
  Relationships: "#FF4444",
  Academics: "#7B61FF",
  Money: "#00C566",
  Drama: "#FF8C00",
  Work: "#00A8FF",
};

export const CAMPUS_SHORT: Record<string, string> = { "UG Legon": "Legon" };

export const SITE_URL = "https://whispa-nu.vercel.app";

export type Confession = {
  id: string;
  content: string;
  campus: string;
  category: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  comment_count?: number;
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

export function whatsappLink(campus: string, content: string): string {
  const text = `👀 Someone at ${campus} confessed on Whispa 🤫\n\n'${content}'\n\nRead more confessions 👇\n${SITE_URL}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
