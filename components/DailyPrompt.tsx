"use client";

import { useEffect, useState } from "react";
import { questionOfTheDay } from "@/lib/prompts";

// A new question every day. Tapping it opens the composer with the question already filled in.
export default function DailyPrompt({ onAnswer }: { onAnswer: (question: string) => void }) {
  // Chosen after the page loads so server and browser always agree, even around midnight.
  const [question, setQuestion] = useState<string | null>(null);
  useEffect(() => setQuestion(questionOfTheDay()), []);

  if (!question) return null;

  return (
    <button
      onClick={() => onAnswer(question)}
      className="mb-3 block w-full animate-fade-up rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-white p-4 text-left shadow-sm transition active:scale-[0.99]"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">💭 Question of the day</p>
      <p className="mt-1 text-[17px] font-bold leading-snug text-ink">{question}</p>
      <p className="mt-2 text-sm font-medium text-accent-dark">Answer anonymously →</p>
    </button>
  );
}
