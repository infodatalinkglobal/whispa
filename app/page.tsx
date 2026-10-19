import Feed from "@/components/Feed";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 pb-28 pt-8">
      <header className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-white">Whispa</h1>
        <p className="mt-1 text-gray-400">Say it. Nobody knows.</p>
      </header>
      <Feed />
    </main>
  );
}
