import { ImageResponse } from "next/og";
import { loadFont } from "@/lib/ogFont";

export const runtime = "edge";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORY_EMOJI: Record<string, string> = {
  Relationships: "💔",
  Academics: "📚",
  Money: "💰",
  Drama: "☕",
  Work: "🔧",
};

// Shorter confessions get bigger type; long ones shrink so they always fit.
function fontSizeFor(length: number): number {
  if (length <= 60) return 104;
  if (length <= 120) return 88;
  if (length <= 220) return 72;
  if (length <= 340) return 60;
  return 50;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return new Response("Not found", { status: 404 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return new Response("Not configured", { status: 500 });

  // Only approved confessions are readable with the public key, and only these three columns are used.
  const res = await fetch(
    `${base}/rest/v1/confessions?id=eq.${params.id}&is_approved=eq.true&select=content,campus,category`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const rows: { content: string; campus: string; category: string }[] = res.ok ? await res.json() : [];
  const confession = rows[0];
  if (!confession) return new Response("Not found", { status: 404 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/^https?:\/\//, "");
  const text = confession.content.trim();

  const [semibold, bold, extrabold] = await Promise.all([loadFont(600), loadFont(700), loadFont(800)]);
  const fonts = [
    semibold && { name: "Inter", data: semibold, weight: 600 as const, style: "normal" as const },
    bold && { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
    extrabold && { name: "Inter", data: extrabold, weight: 800 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "110px 90px",
          background: "#0a0a0a",
          backgroundImage: "radial-gradient(circle at 50% 0%, rgba(0,215,114,0.30) 0%, rgba(10,10,10,0) 55%)",
          color: "#ffffff",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 80, fontWeight: 800, letterSpacing: -2 }}>Whispa</div>
          <div style={{ fontSize: 68 }}>🤫</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 240, lineHeight: 0.7, color: "#00D772", fontWeight: 800, marginBottom: 30 }}>“</div>
          <div
            style={{
              fontSize: fontSizeFor(text.length),
              lineHeight: 1.28,
              fontWeight: 700,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {text}
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 64 }}>
            <div
              style={{
                display: "flex",
                padding: "18px 36px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.12)",
                fontSize: 38,
                fontWeight: 600,
              }}
            >
              {CATEGORY_EMOJI[confession.category] ?? ""} {confession.category}
            </div>
            <div
              style={{
                display: "flex",
                padding: "18px 36px",
                borderRadius: 999,
                background: "#00D772",
                color: "#04140b",
                fontSize: 38,
                fontWeight: 700,
              }}
            >
              {confession.campus}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 46, color: "#a0a0a0" }}>Say it. Nobody knows.</div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#00D772" }}>{appUrl}</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: fonts.length ? fonts : undefined,
      // Short cache: a post that gets hidden should stop being served as an image within minutes.
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    }
  );
}
