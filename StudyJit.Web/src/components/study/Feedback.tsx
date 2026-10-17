"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { useEffect } from "react";

const praise = ["Nice!", "Correct!", "Great job!", "You got it!", "Spot on!", "Excellent!"];
const encouragement = ["Not quite", "Almost", "Keep going", "Good try"];

/** What shows after answering: right or wrong, the right answer, why, and a button (or Enter) to go on. */
export default function Feedback({
  correct,
  answer,
  given,
  explanation,
  onContinue,
  onOverride,
}: {
  correct: boolean;
  answer: string;
  given?: string;
  explanation?: string;
  onContinue: () => void;
  /** For typed answers: count it as right after all. */
  onOverride?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onContinue();
      }
    };
    // Wait a beat so the Enter that submitted the answer doesn't also skip this.
    const timer = setTimeout(() => window.addEventListener("keydown", onKey), 150);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onContinue]);

  const word = (list: string[]) => list[(answer.length + (given?.length ?? 0)) % list.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={`mt-6 rounded-2xl border p-5 ${
        correct ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"
      }`}
    >
      <div className="flex items-start gap-3">
        <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
          {correct ? <CheckCircle2 className="w-7 h-7 text-emerald-500" /> : <XCircle className="w-7 h-7 text-red-500" />}
        </motion.span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-lg ${correct ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {correct ? word(praise) : word(encouragement)}
          </p>
          {!correct && (
            <p className="mt-1">
              <span className="text-muted">Correct answer: </span>
              <span className="font-semibold">{answer}</span>
            </p>
          )}
          {!correct && given && (
            <p className="text-sm text-muted mt-0.5">
              You said: <span className="line-through">{given}</span>
            </p>
          )}
          {explanation && (
            <p className="mt-3 flex gap-2 text-sm">
              <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>{explanation}</span>
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {!correct && onOverride && (
          <button onClick={onOverride} className="btn-ghost text-sm">
            I was right
          </button>
        )}
        <button onClick={onContinue} className="btn-primary">
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
