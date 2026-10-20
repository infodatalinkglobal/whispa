import { ImageResponse } from "next/og";
import { loadFont } from "@/lib/ogFont";

export const runtime = "edge";
export const alt = "Send me an anonymous message on Whispa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The picture that shows when someone's link is pasted into WhatsApp. It doesn't depend on the code,
// so it never reveals who the link belongs to.
export default async function Image() {
  const [bold, extrabold] = await Promise.all([loadFont(700), loadFont(800)]);
  const fonts = [
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
          justifyContent: "center",
          padding: "0 90px",
          background: "#0a0a0a",
          backgroundImage: "radial-gradient(circle at 15% 0%, rgba(0,215,114,0.35) 0%, rgba(10,10,10,0) 60%)",
          color: "#ffffff",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 52, fontWeight: 800 }}>
          Whispa <span style={{ fontSize: 46 }}>🤫</span>
        </div>
        <div style={{ marginTop: 40, fontSize: 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          Send me an
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, color: "#00D772" }}>
          anonymous message
        </div>
        <div style={{ marginTop: 36, fontSize: 38, fontWeight: 700, color: "#a0a0a0" }}>
          They&apos;ll never know it&apos;s you.
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  );
}
