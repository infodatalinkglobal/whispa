import type { Metadata } from "next";
import SendMessage from "@/components/SendMessage";

export const metadata: Metadata = {
  title: "Send me an anonymous message 🤫 — Whispa",
  description: "They'll never know it's you.",
  // A private link: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function MessagePage({ params }: { params: { code: string } }) {
  return (
    <main className="flex min-h-screen justify-center px-4 py-10">
      <SendMessage code={params.code.toLowerCase()} />
    </main>
  );
}
