"use client";

import { motion } from "framer-motion";
import { CheckSquare, ClipboardCheck, ListChecks, PenLine, Play, Timer, ToggleLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatTime,
  isRight,
  mcqItem,
  answerText,
  pickFrom,
  pickQuestions,
  recordAnswer,
  saveScore,
  shortAnswerItem,
  shortAnswerKey,
  shuffle,
  statementItem,
  statementKey,
  writtenFromTerm,
  type Item,
  type StudyQuiz,
} from "@/lib/study";
import AlertPopup from "@/components/AlertPopup";
import ItemView from "./ItemView";
import Results from "./Results";
import StudyShell, { ShellStat } from "./StudyShell";

type Kind = Item["kind"];

const kinds: { kind: Kind; title: string; icon: typeof ListChecks }[] = [
  { kind: "mcq", title: "Multiple choice", icon: ListChecks },
  { kind: "tf", title: "True / false", icon: ToggleLeft },
  { kind: "written", title: "Written", icon: PenLine },
];

/** Each question type's own pool: questions, statements, and short answers (or key terms when there are none). */
function pools(quiz: StudyQuiz): Record<Kind, () => Item[]> {
  return {
    mcq: () => pickQuestions(quiz.id, quiz.questions, quiz.questions.length).map(mcqItem),
    tf: () => pickFrom(quiz.id, quiz.statements, statementKey, quiz.statements.length).map(statementItem),
    written: () =>
      quiz.shortAnswers.length
        ? pickFrom(quiz.id, quiz.shortAnswers, shortAnswerKey, quiz.shortAnswers.length).map(shortAnswerItem)
        : shuffle(quiz.terms).map(writtenFromTerm),
  };
}

const poolSize = (quiz: StudyQuiz, kind: Kind) =>
  kind === "mcq" ? quiz.questions.length : kind === "tf" ? quiz.statements.length : quiz.shortAnswers.length || quiz.terms.length;

/** Builds a test of the chosen size, taking turns between the chosen types (each from its own pool, new and missed first). */
function buildTest(quiz: StudyQuiz, count: number, chosen: Kind[]): Item[] {
  const queues = chosen.map((kind) => pools(quiz)[kind]());
  const items: Item[] = [];
  for (let round = 0; items.length < count && queues.some((q) => q.length); round++)
    for (const queue of queues) if (items.length < count && queue.length) items.push(queue.shift()!);
  return shuffle(items);
}

/** A full test: choose its size, question types and timing, answer it all, then see a graded review. */
export default function Test({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const available = kinds.map((k) => k.kind).filter((k) => poolSize(quiz, k) > 0);
  const [chosen, setChosen] = useState<Kind[]>(available);
  const max = Math.max(1, chosen.reduce((n, k) => n + poolSize(quiz, k), 0));
  const [count, setCount] = useState(Math.min(max, 20));
  const [timed, setTimed] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [confirm, setConfirm] = useState(false);

  // A minute per question when timed.
  const limit = items ? items.length * 60_000 : 0;
  const elapsed = now - startedAt;

  useEffect(() => {
    if (!items || submitted) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [items, submitted]);

  useEffect(() => {
    if (timed && items && !submitted && elapsed >= limit) setSubmitted(true);
  }, [timed, items, submitted, elapsed, limit]);

  const score = useMemo(() => (items ? items.filter((it) => isRight(it, answers[it.key])).length : 0), [items, answers]);

  useEffect(() => {
    if (!submitted || !items) return;
    saveScore(quiz.id, (score / items.length) * 100);
    for (const it of items) if (it.hid) recordAnswer(quiz.id, it.hid, isRight(it, answers[it.key]));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    setItems(buildTest(quiz, count, chosen));
    setAnswers({});
    setSubmitted(false);
    setStartedAt(Date.now());
    setNow(Date.now());
    window.scrollTo({ top: 0 });
  };

  if (!items) {
    return (
      <StudyShell mode="Test" title={quiz.name} onExit={onExit}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-8 max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 text-white flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-2xl font-extrabold">Set up your test</h2>
              <p className="text-sm text-muted">Results and explanations come at the end.</p>
            </div>
          </div>

          <label className="label">Questions</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={max}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="flex-1 accent-[var(--brand)]"
            />
            <span className="w-12 text-center text-2xl font-extrabold text-brand tabular-nums">{count}</span>
          </div>

          <label className="label mt-6">Question types</label>
          <div className="grid grid-cols-3 gap-2">
            {kinds.map(({ kind, title, icon: Icon }) => {
              const on = chosen.includes(kind);
              const none = !available.includes(kind);
              return (
                <button
                  key={kind}
                  disabled={none}
                  title={none ? "This set has none; regenerate it to get them" : undefined}
                  onClick={() => {
                    const next = on ? (chosen.length > 1 ? chosen.filter((k) => k !== kind) : chosen) : [...chosen, kind];
                    setChosen(next);
                    setCount((c) => Math.min(c, Math.max(1, next.reduce((n, k) => n + poolSize(quiz, k), 0))));
                  }}
                  className={`relative rounded-2xl border-2 p-3 flex flex-col items-center gap-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    on && !none ? "border-brand bg-brand-soft text-brand" : "border-stroke text-muted hover:border-brand/40"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {title}
                  {on && !none && <CheckSquare className="absolute top-2 right-2 w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setTimed(!timed)}
            className="mt-6 w-full flex items-center justify-between rounded-2xl border border-stroke px-4 py-3 hover:bg-surface-2 transition"
          >
            <span className="flex items-center gap-3">
              <Timer className="w-5 h-5 text-muted" />
              <span className="text-left">
                <span className="block font-semibold">Timed</span>
                <span className="block text-xs text-muted">One minute per question: {count} min</span>
              </span>
            </span>
            <span className={`relative w-11 h-6 rounded-full transition ${timed ? "bg-brand" : "bg-stroke"}`}>
              <motion.span layout className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow ${timed ? "right-1" : "left-1"}`} />
            </span>
          </button>

          <button onClick={start} className="btn-primary w-full mt-8 py-3 text-lg">
            <Play className="w-5 h-5" /> Start test
          </button>
        </motion.div>
      </StudyShell>
    );
  }

  const answered = items.filter((it) => answers[it.key] !== undefined && answers[it.key] !== "").length;

  if (submitted) {
    return (
      <StudyShell mode="Test" title={quiz.name} progress={1} onExit={onExit}>
        <Results
          percent={(score / items.length) * 100}
          stats={[
            { label: "Correct", value: `${score}/${items.length}` },
            { label: "Time", value: formatTime(Math.min(elapsed, timed ? limit : elapsed)).replace(/\.\d$/, "") },
            { label: "Skipped", value: String(items.length - answered) },
          ]}
          review={items.map((it) => {
            const g = answers[it.key];
            return {
              prompt: it.kind === "tf" ? it.statement : it.prompt,
              answer: answerText(it),
              given: g === undefined ? undefined : typeof g === "boolean" ? (g ? "True" : "False") : g,
              correct: isRight(it, g),
              explanation: it.explanation,
            };
          })}
          onRetry={start}
          onDone={onExit}
        />
      </StudyShell>
    );
  }

  const remaining = limit - elapsed;
  return (
    <StudyShell
      mode="Test"
      title={quiz.name}
      progress={answered / items.length}
      onExit={onExit}
      right={
        <>
          {timed && (
            <ShellStat icon={<Timer className="w-4 h-4" />} tone={remaining < 60_000 ? "text-red-500" : "text-muted"}>
              {formatTime(remaining).replace(/\.\d$/, "")}
            </ShellStat>
          )}
          <ShellStat>
            {answered}/{items.length}
          </ShellStat>
        </>
      }
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        {items.map((it, i) => (
          <motion.div
            key={it.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 6) * 0.05 }}
            className="card p-6"
          >
            <ItemView
              item={it}
              index={i}
              given={answers[it.key]}
              revealed={false}
              lockOnAnswer={false}
              keyboard={false}
              onAnswer={(g) => setAnswers((a) => ({ ...a, [it.key]: g }))}
            />
          </motion.div>
        ))}
        <button
          onClick={() => (answered < items.length ? setConfirm(true) : setSubmitted(true))}
          className="btn-primary py-3.5 text-lg"
        >
          Submit test
        </button>
      </div>

      {confirm && (
        <AlertPopup
          message={`You've answered ${answered} of ${items.length}. Unanswered questions count as wrong.`}
          onClose={() => setConfirm(false)}
          actions={[
            { label: "Keep going", color: "gray", onClick: () => setConfirm(false) },
            {
              label: "Submit",
              color: "blue",
              onClick: () => {
                setConfirm(false);
                setSubmitted(true);
              },
            },
          ]}
        />
      )}
    </StudyShell>
  );
}
