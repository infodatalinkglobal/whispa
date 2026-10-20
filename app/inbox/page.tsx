import InboxView from "@/components/InboxView";

export const metadata = { title: "My inbox — Whispa" };

export default function InboxPage() {
  return (
    <main className="mx-auto min-h-screen max-w-[560px] px-4 pb-16 pt-6">
      <InboxView />
    </main>
  );
}
