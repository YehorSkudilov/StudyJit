"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/** How far a generation has got, as the API reports it while one runs (see GenerationProgress.cs). */
export interface GenerationProgressInfo {
  stage: string;
  percent: number;
  files_done: number;
  files_total: number;
  questions: number;
  statements: number;
  short_answers: number;
  written_answers: number;
  terms: number;
  cheat_sheet_words: number;
  started_at: string;
}

interface Step {
  stage: string;
  label: string;
  count?: (p: GenerationProgressInfo) => string;
}

/** The stages in the order they run; the file stages only show when there are documents to read. */
const steps: Step[] = [
  { stage: "reading", label: "Reading your files", count: (p) => `${p.files_done}/${p.files_total}` },
  { stage: "indexing", label: "Making them searchable" },
  { stage: "thinking", label: "Planning what to cover" },
  { stage: "questions", label: "Multiple-choice questions", count: (p) => String(p.questions) },
  { stage: "true_false", label: "True-or-false statements", count: (p) => String(p.statements) },
  { stage: "short_answers", label: "Short answers", count: (p) => String(p.short_answers) },
  { stage: "written_answers", label: "Exam questions", count: (p) => String(p.written_answers) },
  { stage: "summary", label: "Study guide" },
  { stage: "terms", label: "Key terms", count: (p) => String(p.terms) },
  { stage: "cheat_sheet", label: "Cheat sheet", count: (p) => `~${p.cheat_sheet_words} words` },
  { stage: "saving", label: "Saving" },
];

const visibleSteps = (p: GenerationProgressInfo) => steps.filter((s) => p.files_total > 0 || (s.stage !== "reading" && s.stage !== "indexing"));

const labelOf = (p: GenerationProgressInfo) => {
  const step = steps.find((s) => s.stage === p.stage);
  if (!step) return "Working…";
  return step.count && p.stage !== "reading" ? `Writing ${step.label.toLowerCase()} · ${step.count(p)}` : step.label;
};

function useElapsed(since?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  if (!since) return null;
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Bar({ percent, indeterminate }: { percent: number; indeterminate?: boolean }) {
  return (
    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
      {indeterminate ? (
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand to-brand-2"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
        />
      ) : (
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      )}
    </div>
  );
}

/**
 * A generation's progress: a bar with the percentage and what the AI is writing now, and (in full) each stage ticked
 * off with how many items it has written so far. Queued or not started yet, it says so.
 */
export default function GenerationProgress({
  progress,
  status,
  queueNumber,
  compact = false,
}: {
  progress?: GenerationProgressInfo | null;
  status?: string | null;
  queueNumber?: number | null;
  compact?: boolean;
}) {
  const elapsed = useElapsed(progress?.started_at);

  if (!progress) {
    const text = status === "queued" ? `Queued${queueNumber ? ` · #${queueNumber} in line` : ""}` : "Starting…";
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> {text}
          </span>
        </div>
        <Bar percent={0} indeterminate />
      </div>
    );
  }

  const shown = visibleSteps(progress);
  const current = shown.findIndex((s) => s.stage === progress.stage);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="flex items-center gap-1.5 min-w-0 text-foreground">
          <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin text-brand" />
          <span className="truncate">{labelOf(progress)}</span>
        </span>
        <span className="tabular-nums text-muted flex-shrink-0">
          {progress.percent}%{!compact && elapsed && ` · ${elapsed}`}
        </span>
      </div>
      <Bar percent={progress.percent} />
      {!compact && (
        <ol className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-sm">
          {shown.map((s, i) => {
            const state = i < current ? "done" : i === current ? "active" : "todo";
            const count = s.count && state !== "todo" && s.stage !== "summary" ? s.count(progress) : null;
            return (
              <li key={s.stage} className={`flex items-center gap-2.5 ${state === "todo" ? "text-muted/70" : ""}`}>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    state === "done" ? "bg-emerald-500 text-white" : state === "active" ? "bg-brand-soft text-brand" : "border border-stroke"
                  }`}
                >
                  {state === "done" ? <Check className="w-3 h-3" /> : state === "active" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                </span>
                <span className={`flex-1 truncate ${state === "active" ? "font-semibold" : ""}`}>{s.label}</span>
                {count && <span className="tabular-nums text-xs text-muted">{count}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
