import { ImageResponse } from "next/og";
import { loadFont } from "@/lib/ogFont";

export const runtime = "edge";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fontSizeFor(length: number): number {
  if (length <= 60) return 100;
  if (length <= 120) return 84;
  if (length <= 220) return 68;
  if (length <= 340) return 56;
  return 48;
}

// An image of one anonymous message, for the owner to post on their Status. It needs the owner's login token:
// the database only lets the person who received the message read it, so nobody else can make this image.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return new Response("Not found", { status: 404 });

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return new Response("Not configured", { status: 500 });
  const headers = { apikey: key, Authorization: auth };

  const [msgRes, inboxRes] = await Promise.all([
    fetch(`${base}/rest/v1/anon_messages?id=eq.${params.id}&select=content`, { headers }),
    fetch(`${base}/rest/v1/inboxes?select=code`, { headers }),
  ]);
  const messages: { content: string }[] = msgRes.ok ? await msgRes.json() : [];
  const inboxes: { code: string }[] = inboxRes.ok ? await inboxRes.json() : [];
  const message = messages[0];
  if (!message) return new Response("Not found", { status: 404 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const link = inboxes[0] ? `${appUrl}/m/${inboxes[0].code}`.replace(/^https?:\/\//, "") : appUrl.replace(/^https?:\/\//, "");
  const text = message.content.trim();

  const [semibold, bold, extrabold] = await Promise.all([loadFont(600), loadFont(700), loadFont(800)]);
  const fonts = [
    semibold && { name: "Inter", data: semibold, weight: 600 as const, style: "normal" as const },
    bold && { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
    extrabold && { name: "Inter", data: extrabold, weight: 800 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "110px 80px",
          background: "#0a0a0a",
          backgroundImage: "radial-gradient(circle at 50% 0%, rgba(0,215,114,0.30) 0%, rgba(10,10,10,0) 55%)",
          color: "#ffffff",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>Whispa</div>
          <div style={{ fontSize: 64 }}>🤫</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "16px 34px",
              borderRadius: 999,
              background: "#00D772",
              color: "#04140b",
              fontSize: 36,
              fontWeight: 800,
              marginBottom: 40,
            }}
          >
            💌 anonymous message
          </div>
          <div
            style={{
              display: "flex",
              padding: "64px 60px",
              borderRadius: 56,
              background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.14)",
              fontSize: fontSizeFor(text.length),
              lineHeight: 1.28,
              fontWeight: 700,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {text}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 50, fontWeight: 700 }}>Send me one too 👇</div>
          <div style={{ fontSize: 42, fontWeight: 700, color: "#00D772" }}>{link}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts: fonts.length ? fonts : undefined }
  );

  // Private: never store this image in a shared cache.
  return new Response(image.body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
