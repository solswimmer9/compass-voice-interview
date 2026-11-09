import { useEffect, useState } from "react";

export function FlippingWord({
  words,
  intervalMs = 2600,
}: {
  words: string[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % words.length),
      intervalMs,
    );
    return () => clearInterval(timer);
  }, [words.length, intervalMs]);

  return (
    <span key={words[index]} className="flip-word inline-block text-[#A3C1AD]">
      {words[index]}
    </span>
  );
}
