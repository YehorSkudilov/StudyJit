"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";

/** The frame of every study mode: a close button, the mode and set names, a progress bar and room for stats. */
export default function StudyShell({
  mode,
  title,
  progress,
  onExit,
  right,
  children,
}: {
  mode: string;
  title: string;
  /** 0 to 1; leave out for no bar. */
  progress?: number;
  onExit: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-stroke/70 bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl h-16 px-4 flex items-center gap-3">
          <button onClick={onExit} className="icon-btn" aria-label="Exit">
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-brand">{mode}</p>
            <p className="font-semibold truncate">{title}</p>
          </div>
          {right && <div className="flex items-center gap-3 text-sm font-semibold">{right}</div>}
        </div>
        {progress !== undefined && (
          <div className="h-1 bg-surface-2">
            <motion.div
              className="h-full bg-gradient-to-r from-brand to-brand-2"
              initial={false}
              animate={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        )}
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">{children}</main>
    </div>
  );
}

/** A small stat in the shell's header, e.g. a timer or a streak. */
export function ShellStat({ icon, children, tone = "text-muted" }: { icon?: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 tabular-nums ${tone}`}>
      {icon}
      {children}
    </span>
  );
}
