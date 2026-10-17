"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const colors = ["#1d6fd8", "#22c3d6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

/** A one-off burst of confetti over the whole screen, for a great result. */
export default function Confetti({ pieces = 80 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        drift: (Math.random() - 0.5) * 220,
        delay: Math.random() * 0.4,
        duration: 2.2 + Math.random() * 1.6,
        rotate: (Math.random() - 0.5) * 720,
        size: 6 + Math.random() * 8,
        color: colors[i % colors.length],
        round: Math.random() > 0.6,
      })),
    [pieces]
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[7000] overflow-hidden" aria-hidden>
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="absolute top-0"
          style={{
            left: `${b.x}%`,
            width: b.size,
            height: b.round ? b.size : b.size * 0.45,
            background: b.color,
            borderRadius: b.round ? "50%" : 2,
          }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: b.drift, rotate: b.rotate, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: b.duration, delay: b.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
