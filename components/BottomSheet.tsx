"use client";

import { useEffect, useState } from "react";

// Slides up from the bottom on phones; sits centered on larger screens.
export default function BottomSheet({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-3 shadow-2xl transition-transform duration-300 ease-out sm:rounded-3xl ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#e2e2e2]" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
