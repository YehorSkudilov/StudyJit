"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Code2, Eye, Loader2, MessageSquareText, RotateCcw, Send, XCircle } from "lucide-react";
import { useState } from "react";
import Markdown from "@/components/ui/Markdown";
import ScoreRing from "@/components/ui/ScoreRing";
import { gradeWritten, pickFrom, recordAnswer, type StudyQuiz, type WrittenAnswer, type WrittenGrade } from "@/lib/study";
import Results, { type ReviewRow } from "./Results";
import StudyShell, { ShellStat } from "./StudyShell";

const writtenKey = (w: WrittenAnswer) => `w${w.id}`;
const roundSize = 8;

const verdictStyle = {
  correct: { label: "Full marks", tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/40" },
  partial: { label: "Partly right", tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/12 border-amber-500/40" },
  incorrect: { label: "Not yet", tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/12 border-rose-500/40" },
};

/**
 * Exam-style long answers: explain a concept or write the code, then the AI marks it against the question's key points,
 * says what was covered and missed, and shows a model answer.
 */
export default function ExamAnswers({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const [items, setItems] = useState(() => pickFrom(quiz.id, quiz.writtenAnswers, writtenKey, roundSize));
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState(0);
  const [text, setText] = useState("");
  const [grade, setGrade] = useState<WrittenGrade | null>(null);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [scores, setScores] = useState<{ item: WrittenAnswer; given: string; grade: WrittenGrade }[]>([]);
  const [done, setDone] = useState(false);

  const item = items[index];
  const isCode = item?.kind === "code";
  const average = scores.length ? scores.reduce((n, s) => n + s.grade.score, 0) / scores.length : 0;

  const submit = async () => {
    if (!item || marking || !text.trim()) return;
    setMarking(true);
    setError(null);
    try {
      const g = await gradeWritten(item.id, text);
      setGrade(g);
      setShowModel(g.verdict !== "correct");
      recordAnswer(quiz.id, writtenKey(item), g.verdict === "correct");
      // A retry replaces the earlier mark for the same question.
      setScores((s) => [...s.filter((x) => x.item.id !== item.id), { item, given: text, grade: g }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMarking(false);
    }
  };

  const reveal = () => {
    if (!item) return;
    const g: WrittenGrade = { score: 0, verdict: "incorrect", feedback: "You looked at the model answer without answering.", covered: [], missed: item.keyPoints };
    setGrade(g);
    setShowModel(true);
    recordAnswer(quiz.id, writtenKey(item), false);
    setScores((s) => [...s.filter((x) => x.item.id !== item.id), { item, given: text, grade: g }]);
  };

  const next = () => {
    setGrade(null);
    setText("");
    setError(null);
    setShowModel(false);
    if (index + 1 < items.length) setIndex(index + 1);
    else setDone(true);
  };

  const restart = (list: WrittenAnswer[]) => {
    setItems(list);
    setIndex(0);
    setRound((r) => r + 1);
    setText("");
    setGrade(null);
    setScores([]);
    setShowModel(false);
    setDone(false);
  };

  if (!item && !done)
    return (
      <StudyShell mode="Exam answers" title={quiz.name} onExit={onExit}>
        <div className="card p-8 max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold">No exam questions yet</h2>
          <p className="mt-2 text-muted">Regenerate this set to get explain-and-write-code questions the AI marks.</p>
          <button onClick={onExit} className="btn-primary mt-6">
            Back to study modes
          </button>
        </div>
      </StudyShell>
    );

  if (done) {
    const review: ReviewRow[] = scores.map((s) => ({
      prompt: s.item.question,
      answer: s.item.modelAnswer,
      given: s.given || undefined,
      correct: s.grade.verdict === "correct",
      explanation: `${s.grade.score}/100 · ${s.grade.feedback}`,
    }));
    return (
      <StudyShell mode="Exam answers" title={quiz.name} progress={1} onExit={onExit}>
        <Results
          percent={average}
          stats={[
            { label: "Average mark", value: `${Math.round(average)}%` },
            { label: "Full marks", value: `${scores.filter((s) => s.grade.verdict === "correct").length}/${scores.length}` },
            { label: "Round", value: String(round + 1) },
          ]}
          review={review}
          onRetry={() => restart(pickFrom(quiz.id, quiz.writtenAnswers, writtenKey, roundSize))}
          onRetryMissed={() => restart(scores.filter((s) => s.grade.verdict !== "correct").map((s) => s.item))}
          onDone={onExit}
        />
      </StudyShell>
    );
  }

  const style = grade ? verdictStyle[grade.verdict] : null;

  return (
    <StudyShell
      mode="Exam answers"
      title={quiz.name}
      progress={(index + (grade ? 1 : 0)) / items.length}
      onExit={onExit}
      right={
        <>
          {scores.length > 0 && <ShellStat>avg {Math.round(average)}%</ShellStat>}
          <ShellStat>
            {index + 1}/{items.length}
          </ShellStat>
        </>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${round}-${index}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.25 }}
          className="max-w-3xl mx-auto flex flex-col gap-5"
        >
          <div className="card p-6 sm:p-8">
            <span
              className={`chip mb-4 ${isCode ? "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300" : "bg-violet-500/12 text-violet-600 dark:text-violet-300"}`}
            >
              {isCode ? <Code2 className="w-3.5 h-3.5" /> : <MessageSquareText className="w-3.5 h-3.5" />}
              {isCode ? "Write the code" : "Explain"}
            </span>
            <div className="text-lg font-semibold">
              <Markdown text={item.question} />
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
                // In code answers Tab indents instead of leaving the box.
                if (isCode && e.key === "Tab" && !e.shiftKey) {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const { selectionStart: a, selectionEnd: b } = el;
                  setText(text.slice(0, a) + "    " + text.slice(b));
                  requestAnimationFrame(() => el.setSelectionRange(a + 4, a + 4));
                }
              }}
              readOnly={!!grade || marking}
              spellCheck={!isCode}
              rows={isCode ? 12 : 7}
              placeholder={isCode ? "fun example() {\n    // your code\n}" : "Write your answer as you would in the exam…"}
              className={`input mt-5 resize-y leading-relaxed ${isCode ? "font-mono text-sm" : ""} ${grade ? "opacity-80" : ""}`}
              autoFocus
            />

            {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

            {!grade && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={submit} disabled={marking || !text.trim()} className="btn-primary">
                  {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {marking ? "Marking…" : "Submit for marking"}
                </button>
                <button onClick={reveal} disabled={marking} className="btn-secondary">
                  <Eye className="w-4 h-4" /> Show model answer
                </button>
                <span className="text-xs text-muted hidden sm:inline">Ctrl + Enter to submit</span>
              </div>
            )}
          </div>

          {grade && style && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`card border p-6 sm:p-8 ${style.bg}`}>
              <div className="flex items-center gap-5">
                <ScoreRing percent={grade.score} size={84} stroke={8} />
                <div className="min-w-0">
                  <p className={`text-xl font-extrabold ${style.tone}`}>{style.label}</p>
                  <p className="mt-1 leading-relaxed">{grade.feedback}</p>
                </div>
              </div>

              {(grade.covered.length > 0 || grade.missed.length > 0) && (
                <ul className="mt-5 flex flex-col gap-2">
                  {grade.covered.map((k) => (
                    <li key={`c-${k}`} className="flex gap-2.5">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                      <span>{k}</span>
                    </li>
                  ))}
                  {grade.missed.map((k) => (
                    <li key={`m-${k}`} className="flex gap-2.5">
                      <XCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                      <span className="text-muted">{k}</span>
                    </li>
                  ))}
                </ul>
              )}

              <button onClick={() => setShowModel((v) => !v)} className="mt-5 flex items-center gap-1.5 text-sm font-bold text-brand">
                <ChevronDown className={`w-4 h-4 transition ${showModel ? "rotate-180" : ""}`} />
                {showModel ? "Hide" : "Show"} model answer
              </button>
              {showModel && (
                <div className="mt-3 rounded-2xl bg-surface p-5 border border-stroke">
                  <Markdown text={item.modelAnswer} />
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={next} className="btn-primary">
                  {index + 1 < items.length ? "Next question" : "See results"}
                </button>
                {grade.verdict !== "correct" && (
                  <button
                    onClick={() => {
                      setGrade(null);
                      setShowModel(false);
                    }}
                    className="btn-secondary"
                  >
                    <RotateCcw className="w-4 h-4" /> Improve my answer
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </StudyShell>
  );
}
