"use client";

import { motion } from "framer-motion";
import { BookOpenText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import Markdown from "@/components/ui/Markdown";
import type { StudyQuiz } from "@/lib/study";
import StudyShell from "./StudyShell";

/** The AI's study guide (light Markdown) and a searchable glossary of the key terms. */
export default function Guide({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const [filter, setFilter] = useState("");
  const terms = useMemo(
    () =>
      quiz.terms.filter(
        (t) => !filter || `${t.term} ${t.definition}`.toLowerCase().includes(filter.toLowerCase())
      ),
    [quiz.terms, filter]
  );

  return (
    <StudyShell mode="Study guide" title={quiz.name} onExit={onExit}>
      <div className="grid lg:grid-cols-[1fr_22rem] gap-6 items-start">
        <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-400 text-white flex items-center justify-center">
              <BookOpenText className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold">{quiz.name}</h1>
          </div>
          {quiz.summary ? (
            <Markdown text={quiz.summary} />
          ) : (
            <p className="text-muted">
              This set has no study guide yet. Regenerate it from the set&apos;s page to get a summary and key terms.
            </p>
          )}
        </motion.article>

        {quiz.terms.length > 0 && (
          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-5 lg:sticky lg:top-24 max-h-[calc(100vh-8rem)] flex flex-col"
          >
            <h2 className="font-bold text-lg">Key terms</h2>
            <div className="relative mt-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search terms" className="input pl-10 py-2" />
            </div>
            <dl className="mt-4 overflow-y-auto flex flex-col gap-3 pr-1">
              {terms.map((t) => (
                <div key={t.term} className="rounded-xl bg-surface-2 p-3">
                  <dt className="font-bold text-brand">{t.term}</dt>
                  <dd className="text-sm mt-0.5">{t.definition}</dd>
                </div>
              ))}
              {terms.length === 0 && <p className="text-sm text-muted">No terms match.</p>}
            </dl>
          </motion.aside>
        )}
      </div>
    </StudyShell>
  );
}
