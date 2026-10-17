"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, LayoutGrid, Lightbulb, RotateCcw, Trophy, XCircle } from "lucide-react";
import { useState } from "react";
import Confetti from "@/components/ui/Confetti";
import ScoreRing from "@/components/ui/ScoreRing";

export interface ReviewRow {
  prompt: string;
  answer: string;
  given?: string;
  correct: boolean;
  explanation?: string;
}

/** The end of a session: the score, a few stats, what was missed and where to go next. */
export default function Results({
  percent,
  headline,
  stats,
  review,
  newBest,
  onRetry,
  onRetryMissed,
  onDone,
}: {
  percent: number;
  headline?: string;
  stats: { label: string; value: string }[];
  review?: ReviewRow[];
  newBest?: boolean;
  onRetry: () => void;
  onRetryMissed?: () => void;
  onDone: () => void;
}) {
  const missed = review?.filter((r) => !r.correct) ?? [];
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? review ?? [] : missed;
  const title =
    headline ?? (percent >= 90 ? "Outstanding!" : percent >= 75 ? "Great work!" : percent >= 50 ? "Good progress" : "Keep practising");

  return (
    <div className="max-w-2xl mx-auto">
      {percent >= 80 && <Confetti />}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8 text-center">
        <ScoreRing percent={percent} size={170} />
        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-5 text-3xl font-extrabold">
          {title}
        </motion.h2>
        {newBest && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9, type: "spring" }}
            className="chip mt-3 bg-amber-400/20 text-amber-600 dark:text-amber-400"
          >
            <Trophy className="w-3.5 h-3.5" /> New personal best
          </motion.span>
        )}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="rounded-xl bg-surface-2 p-3"
            >
              <p className="text-xl font-extrabold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted font-medium">{s.label}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          {onRetryMissed && missed.length > 0 && (
            <button onClick={onRetryMissed} className="btn-primary flex-1">
              <RotateCcw className="w-4 h-4" /> Practise {missed.length} missed
            </button>
          )}
          <button onClick={onRetry} className={`${onRetryMissed && missed.length > 0 ? "btn-secondary" : "btn-primary"} flex-1`}>
            <RotateCcw className="w-4 h-4" /> Go again
          </button>
          <button onClick={onDone} className="btn-secondary flex-1">
            <LayoutGrid className="w-4 h-4" /> Study modes
          </button>
        </div>
      </motion.div>

      {review && review.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">{showAll ? "All answers" : missed.length ? "Review what you missed" : "Perfect, nothing missed!"}</h3>
            <button onClick={() => setShowAll(!showAll)} className="btn-ghost text-sm px-3 py-1.5">
              {showAll ? "Missed only" : "Show all"}
              <ChevronDown className={`w-4 h-4 transition ${showAll ? "rotate-180" : ""}`} />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.04 }}
                className={`card p-4 border-l-4 ${r.correct ? "border-l-emerald-500" : "border-l-red-500"}`}
              >
                <div className="flex gap-3">
                  {r.correct ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">{r.prompt}</p>
                    <p className="mt-1 text-sm">
                      <span className="text-muted">Answer: </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.answer}</span>
                    </p>
                    {!r.correct && (
                      <p className="text-sm text-muted">
                        You said: <span className="text-red-500">{r.given || "(no answer)"}</span>
                      </p>
                    )}
                    {r.explanation && (
                      <p className="mt-2 flex gap-2 text-sm text-muted">
                        <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" /> {r.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
