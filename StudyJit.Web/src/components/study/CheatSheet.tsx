"use client";

import { motion } from "framer-motion";
import { AlertTriangle, BookA, Check, Copy, Lightbulb, ListOrdered, Printer, ScrollText, Sigma, Sparkles, type LucideIcon } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { StudyQuiz } from "@/lib/study";
import StudyShell from "./StudyShell";

/** Each section's colours, cycled; a "mistakes" section always gets the warning one. */
const palette = [
  { bar: "from-blue-500 to-sky-400", icon: "bg-blue-500/15 text-blue-600 dark:text-blue-400", mark: "bg-blue-400/25", pill: "bg-blue-500/12 text-blue-700 dark:text-blue-300" },
  { bar: "from-violet-500 to-fuchsia-400", icon: "bg-violet-500/15 text-violet-600 dark:text-violet-400", mark: "bg-violet-400/25", pill: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
  { bar: "from-emerald-500 to-teal-400", icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", mark: "bg-emerald-400/25", pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  { bar: "from-amber-500 to-yellow-400", icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400", mark: "bg-amber-300/40", pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { bar: "from-cyan-500 to-teal-300", icon: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400", mark: "bg-cyan-400/25", pill: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300" },
  { bar: "from-indigo-500 to-blue-400", icon: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", mark: "bg-indigo-400/25", pill: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300" },
];
const warning = { bar: "from-rose-500 to-red-400", icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400", mark: "bg-rose-400/25", pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300" };
type Tone = (typeof palette)[number];

type Line =
  | { kind: "term"; term: string; meaning: string }
  | { kind: "bullet"; text: string }
  | { kind: "step"; n: number; text: string }
  | { kind: "text"; text: string }
  | { kind: "code"; lang: string; code: string };

interface Section {
  title: string;
  lines: Line[];
}

/** Splits the sheet's Markdown into titled sections of definitions, bullets, steps and text. */
function parse(markdown: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let fence: { lang: string; lines: string[] } | null = null;
  const section = () => (current ??= sections[sections.push({ title: "Essentials", lines: [] }) - 1]);
  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    // ``` fenced examples keep their lines and indentation as written.
    const fenceMark = /^(?:[-*]\s+)?```\s*([\w+#.-]*)/.exec(line);
    if (fence) {
      if (line.startsWith("```")) {
        section().lines.push({ kind: "code", lang: fence.lang, code: dedent(fence.lines) });
        fence = null;
      } else fence.lines.push(raw);
      continue;
    }
    if (fenceMark) {
      fence = { lang: fenceMark[1], lines: [] };
      continue;
    }
    if (!line) continue;
    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    if (heading) {
      current = { title: heading[1].replace(/\*\*/g, ""), lines: [] };
      sections.push(current);
      continue;
    }
    current ??= sections[sections.push({ title: "Essentials", lines: [] }) - 1];
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const step = /^(\d+)[.)]\s+(.*)$/.exec(line);
    const body = bullet?.[1] ?? line;
    // "**Term**: meaning" or "Term: meaning", with a short term, reads as a definition.
    const term = /^\*\*(.{1,60}?)\*\*\s*[:–—-]\s+(.+)$/.exec(body) ?? (bullet ? /^([^:*`]{1,40}):\s+(.+)$/.exec(body) : null);
    if (step) current.lines.push({ kind: "step", n: Number(step[1]), text: step[2] });
    else if (term) current.lines.push({ kind: "term", term: term[1], meaning: term[2] });
    else if (bullet) current.lines.push({ kind: "bullet", text: body });
    else current.lines.push({ kind: "text", text: line });
  }
  if (fence) section().lines.push({ kind: "code", lang: fence.lang, code: dedent(fence.lines) });
  return sections.filter((s) => s.lines.length > 0);
}

/** Drops the indentation every line of a code block shares (e.g. from sitting under a bullet). */
function dedent(lines: string[]): string {
  const indents = lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(cut)).join("\n").replace(/^\n+|\s+$/g, "");
}

function iconFor(title: string, lines: Line[]): LucideIcon {
  const t = title.toLowerCase();
  if (/mistake|pitfall|avoid|trap|careful|watch out/.test(t)) return AlertTriangle;
  if (/formula|equation|calculat|math|rule/.test(t)) return Sigma;
  if (/term|definition|vocab|glossary|concept/.test(t)) return BookA;
  if (/step|process|procedure|how to|sequence|order/.test(t) || lines.some((l) => l.kind === "step")) return ListOrdered;
  if (/tip|remember|key|takeaway|summary/.test(t)) return Lightbulb;
  return Sparkles;
}

/** **bold** as a highlighter mark, `code` as a monospace chip. */
function Inline({ text, tone }: { text: string; tone: Tone }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <mark key={i} className={`rounded px-0.5 font-bold text-foreground ${tone.mark} [box-decoration-break:clone]`}>
            {part.slice(2, -2)}
          </mark>
        ) : part.startsWith("`") && part.endsWith("`") ? (
          <code key={i} className="rounded-md bg-surface-2 border border-stroke px-1.5 py-0.5 font-mono text-[0.85em] text-foreground whitespace-nowrap">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

/** The set's one-page cheat sheet: colour-coded section cards to skim, copy or print. */
export default function CheatSheet({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const [copied, setCopied] = useState(false);
  const sections = useMemo(() => parse(quiz.cheatSheet), [quiz.cheatSheet]);
  const termCount = sections.reduce((n, s) => n + s.lines.filter((l) => l.kind === "term").length, 0);

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
            title="Copy as text"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button onClick={() => window.print()} className="btn-secondary px-3 py-1.5 text-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
        </>
      }
    >
      {/* Title strip */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 sm:p-8 text-white shadow-xl mb-6 print:shadow-none print:rounded-none print:p-0 print:mb-4 print:bg-none print:text-black"
      >
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15 print:hidden" />
        <div className="absolute right-24 -bottom-16 h-32 w-32 rounded-full bg-white/10 print:hidden" />
        <div className="relative flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center print:hidden">
            <ScrollText className="w-7 h-7" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/80 print:text-black/60">Cheat sheet</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold truncate">{quiz.name}</h1>
            <p className="text-sm text-white/85 print:text-black/60">
              {sections.length} section{sections.length === 1 ? "" : "s"}
              {termCount > 0 && ` · ${termCount} definitions`}
            </p>
          </div>
        </div>
      </motion.header>

      {/* Section cards, flowing in columns */}
      <div className="columns-1 md:columns-2 xl:columns-3 gap-5 print:columns-2 print:gap-4">
        {sections.map((section, i) => {
          const Icon = iconFor(section.title, section.lines);
          const tone = Icon === AlertTriangle ? warning : palette[i % palette.length];
          return (
            <motion.section
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.06, duration: 0.4 }}
              className="card relative overflow-hidden mb-5 break-inside-avoid print:mb-3 print:shadow-none"
            >
              <div className={`h-1.5 bg-gradient-to-r ${tone.bar}`} />
              <div className="p-5 print:p-3">
                <h2 className="flex items-center gap-2.5 mb-3">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${tone.icon}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="font-extrabold leading-tight">{section.title}</span>
                </h2>
                <div className="flex flex-col gap-2 text-[0.92rem] leading-snug">
                  {section.lines.map((line, j) =>
                    line.kind === "term" ? (
                      <div key={j} className="flex flex-col gap-0.5">
                        <span className={`self-start rounded-lg px-2 py-0.5 text-[0.8rem] font-bold ${tone.pill}`}>
                          <Inline text={line.term} tone={tone} />
                        </span>
                        <span className="pl-1">
                          <Inline text={line.meaning} tone={tone} />
                        </span>
                      </div>
                    ) : line.kind === "step" ? (
                      <div key={j} className="flex gap-2.5">
                        <span className={`w-5 h-5 mt-0.5 rounded-full text-[0.7rem] font-extrabold flex items-center justify-center flex-shrink-0 ${tone.icon}`}>
                          {line.n}
                        </span>
                        <span>
                          <Inline text={line.text} tone={tone} />
                        </span>
                      </div>
                    ) : line.kind === "code" ? (
                      <pre
                        key={j}
                        className="relative rounded-xl bg-surface-2 border border-stroke px-3 py-2.5 font-mono text-[0.8rem] leading-relaxed text-foreground overflow-x-auto print:whitespace-pre-wrap print:overflow-visible"
                      >
                        {line.lang && (
                          <span className={`absolute right-2 top-1.5 rounded px-1.5 text-[0.65rem] font-bold uppercase ${tone.pill}`}>{line.lang}</span>
                        )}
                        <code>{line.code}</code>
                      </pre>
                    ) : line.kind === "bullet" ? (
                      <div key={j} className="flex gap-2.5">
                        <span className={`w-1.5 h-1.5 mt-[0.45rem] rounded-full flex-shrink-0 bg-gradient-to-br ${tone.bar}`} />
                        <span>
                          <Inline text={line.text} tone={tone} />
                        </span>
                      </div>
                    ) : (
                      <p key={j} className="text-muted">
                        <Inline text={line.text} tone={tone} />
                      </p>
                    )
                  )}
                </div>
              </div>
            </motion.section>
          );
        })}
      </div>
    </StudyShell>
  );
}
