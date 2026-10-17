"use client";

import { motion } from "framer-motion";
import { CheckSquare, ClipboardCheck, ListChecks, PenLine, Play, Timer, ToggleLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatTime,
  isRight,
  mcqItem,
  pickQuestions,
  recordAnswer,
  saveScore,
  shuffle,
  trueFalseItem,
  typeable,
  writtenFromQuestion,
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

/** Builds a test of the chosen size, spreading the questions across the chosen types. */
function buildTest(quiz: StudyQuiz, count: number, chosen: Kind[]): Item[] {
  // A fresh mix from the bank each time, favouring what's new or was missed.
  const questions = pickQuestions(quiz.id, quiz.questions, count);
  const writable = quiz.terms.length > 0 ? quiz.terms : [];
  return shuffle(
    questions.map((q, i) => {
      const kind = chosen[i % chosen.length];
      if (kind === "tf") return trueFalseItem(q);
      if (kind === "written") {
        if (typeable(q)) return writtenFromQuestion(q);
        // Long answers are hard to type: ask for a key term instead, or fall back to multiple choice.
        if (writable.length) {
          const t = writable[i % writable.length];
          return writtenFromTerm(t, i);
        }
        return mcqItem(q);
      }
      return mcqItem(q);
    })
  );
}

/** A full test: choose its size, question types and timing, answer it all, then see a graded review. */
export default function Test({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const max = quiz.questions.length;
  const [count, setCount] = useState(Math.min(max, 20));
  const [chosen, setChosen] = useState<Kind[]>(["mcq", "tf", "written"]);
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
    for (const it of items) if (it.qid != null) recordAnswer(quiz.id, it.qid, isRight(it, answers[it.key]));
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
              return (
                <button
                  key={kind}
                  onClick={() => setChosen(on ? (chosen.length > 1 ? chosen.filter((k) => k !== kind) : chosen) : [...chosen, kind])}
                  className={`relative rounded-2xl border-2 p-3 flex flex-col items-center gap-2 text-sm font-semibold transition ${
                    on ? "border-brand bg-brand-soft text-brand" : "border-stroke text-muted hover:border-brand/40"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {title}
                  {on && <CheckSquare className="absolute top-2 right-2 w-3.5 h-3.5" />}
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
              prompt: it.kind === "tf" ? `${it.prompt} — “${it.statement}”` : it.prompt,
              answer: it.kind === "tf" ? (it.answer ? "True" : `False (it's “${it.truth}”)`) : it.answer,
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
