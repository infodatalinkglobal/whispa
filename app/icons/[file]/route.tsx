import { ImageResponse } from "next/og";
import { loadFont } from "@/lib/ogFont";

export const runtime = "edge";

const SIZES = new Set([180, 192, 512]);

// App icon for the home screen: a white "W" on Whispa green, drawn edge to edge so it also works
// as a maskable icon (the letter sits well inside the safe zone).
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const size = Number.parseInt(params.file, 10);
  if (!params.file.endsWith(".png") || !SIZES.has(size)) return new Response("Not found", { status: 404 });

  const extrabold = await loadFont(800);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #00E680 0%, #00B85F 100%)",
          color: "#ffffff",
          fontFamily: "Inter",
          fontSize: Math.round(size * 0.58),
          fontWeight: 800,
          letterSpacing: -size * 0.02,
        }}
      >
        W
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: extrabold ? [{ name: "Inter", data: extrabold, weight: 800, style: "normal" }] : undefined,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    }
  );
}
