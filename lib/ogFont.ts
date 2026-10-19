const FONT_BASE = "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.8/files";

const fontCache = new Map<number, ArrayBuffer>();

// Inter for generated images. Cached after the first load, and capped at 3 seconds so a slow font host
// never holds a request up: the image then falls back to the default font.
export async function loadFont(weight: 600 | 700 | 800): Promise<ArrayBuffer | null> {
  const cached = fontCache.get(weight);
  if (cached) return cached;
  try {
    const res = await fetch(`${FONT_BASE}/inter-latin-${weight}-normal.woff`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    fontCache.set(weight, data);
    return data;
  } catch {
    return null;
  }
}
