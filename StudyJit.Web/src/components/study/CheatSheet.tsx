"use client";

import { motion } from "framer-motion";
import { Check, Copy, Printer, ScrollText } from "lucide-react";
import { useState } from "react";
import type { StudyQuiz } from "@/lib/study";
import Markdown from "@/components/ui/Markdown";
import StudyShell from "./StudyShell";

/** The set's one-page cheat sheet, to skim, copy or print. */
export default function CheatSheet({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <StudyShell
      mode="Cheat sheet"
      title={quiz.name}
      onExit={onExit}
      right={
        <>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(quiz.cheatSheet).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="icon-btn"
            title="Copy"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button onClick={() => window.print()} className="icon-btn" title="Print">
            <Printer className="w-4 h-4" />
          </button>
        </>
      }
    >
      <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-10 print:shadow-none print:border-0">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 text-white flex items-center justify-center print:hidden">
            <ScrollText className="w-5 h-5" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold">{quiz.name}</h1>
        </div>
        <div className="columns-1 xl:columns-2 gap-10">
          <Markdown text={quiz.cheatSheet} />
        </div>
      </motion.article>
    </StudyShell>
  );
}
