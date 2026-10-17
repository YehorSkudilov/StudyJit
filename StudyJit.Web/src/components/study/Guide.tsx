"use client";

import { motion } from "framer-motion";
import { BookOpenText, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
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

/** Headings (#, ##, ###), bullet lists (- or *), numbered lists and **bold**: what the guide is written in. */
function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list = null as { ordered: boolean; items: string[] } | null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length} className="leading-relaxed">{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => (
      <li key={i} className="pl-1">
        {inline(it)}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="list-decimal pl-6 flex flex-col gap-1.5 marker:text-brand marker:font-bold">
          {items}
        </ol>
      ) : (
        <ul key={blocks.length} className="list-disc pl-6 flex flex-col gap-1.5 marker:text-brand">
          {items}
        </ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(
        <h2
          key={blocks.length}
          className={level === 1 ? "text-2xl font-extrabold mt-4" : level === 2 ? "text-xl font-bold mt-6 pb-1 border-b border-stroke" : "text-lg font-bold mt-4"}
        >
          {inline(heading[2])}
        </h2>
      );
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return <div className="flex flex-col gap-3 text-[1.02rem]">{blocks}</div>;
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-bold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
