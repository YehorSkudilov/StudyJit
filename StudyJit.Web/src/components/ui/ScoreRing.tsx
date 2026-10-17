"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

/** The colour a percentage reads as: green for good, amber for getting there, red for needs work. */
export function scoreColor(percent: number) {
  return percent >= 80 ? "#10b981" : percent >= 50 ? "#f59e0b" : "#ef4444";
}

/** A ring that fills to the percentage, counting the number up as it goes. */
export default function ScoreRing({
  percent,
  size = 160,
  stroke = 12,
  label,
  animated = true,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
  animated?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = useMotionValue(animated ? 0 : percent);
  const offset = useTransform(value, (v) => circumference * (1 - v / 100));
  const [shown, setShown] = useState(animated ? 0 : Math.round(percent));

  useEffect(() => {
    if (!animated) {
      value.set(percent);
      setShown(Math.round(percent));
      return;
    }
    const controls = animate(value, percent, { duration: 1.2, ease: [0.22, 1, 0.36, 1] });
    const unsubscribe = value.on("change", (v) => setShown(Math.round(v)));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [percent, animated, value]);

  const color = scoreColor(percent);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className="stroke-surface-2" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-extrabold tabular-nums" style={{ fontSize: size * 0.24, color }}>
          {shown}%
        </span>
        {label && <span className="text-xs text-muted font-medium">{label}</span>}
      </div>
    </div>
  );
}
