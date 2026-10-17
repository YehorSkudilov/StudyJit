"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { mcqItem, saveScore, shuffle, isRight, type Question, type StudyQuiz } from "@/lib/study";
import Feedback from "./Feedback";
import ItemView from "./ItemView";
import Results, { type ReviewRow } from "./Results";
import StudyShell, { ShellStat } from "./StudyShell";

/** One question at a time, with the answer and its explanation straight after, and a streak to keep alive. */
export default function Practice({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const [pool, setPool] = useState<Question[]>(() => shuffle(quiz.questions));
  const [round, setRound] = useState(0);
  const items = useMemo(() => pool.map(mcqItem), [pool, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<string | undefined>();
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [done, setDone] = useState(false);

  const item = items[index];
  const answered = given !== undefined;
  const correct = answered && isRight(item, given);
  const score = review.filter((r) => r.correct).length;

  const answer = useCallback(
    (value: string | boolean) => {
      if (given !== undefined) return;
      const v = String(value);
      const right = isRight(item, v);
      setGiven(v);
      setStreak((s) => {
        const next = right ? s + 1 : 0;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
      setReview((r) => [
        ...r,
        { prompt: item.prompt, answer: item.kind === "mcq" ? item.answer : "", given: v, correct: right, explanation: item.explanation },
      ]);
    },
    [given, item]
  );

  const next = useCallback(() => {
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setGiven(undefined);
    } else {
      setDone(true);
      // Only a full run counts as the set's score.
      if (pool.length === quiz.questions.length) saveScore(quiz.id, (score / items.length) * 100);
    }
  }, [index, items.length, pool.length, quiz.id, quiz.questions.length, score]);

  const restart = (questions: Question[]) => {
    setPool(shuffle(questions));
    setRound((r) => r + 1);
    setIndex(0);
    setGiven(undefined);
    setReview([]);
    setStreak(0);
    setBestStreak(0);
    setDone(false);
  };

  if (done) {
    const missed = new Set(review.filter((r) => !r.correct).map((r) => r.prompt));
    return (
      <StudyShell mode="Practice" title={quiz.name} progress={1} onExit={onExit}>
        <Results
          percent={(score / items.length) * 100}
          stats={[
            { label: "Correct", value: `${score}/${items.length}` },
            { label: "Best streak", value: String(bestStreak) },
            { label: "Missed", value: String(items.length - score) },
          ]}
          review={review}
          onRetry={() => restart(quiz.questions)}
          onRetryMissed={() => restart(quiz.questions.filter((q) => missed.has(q.question)))}
          onDone={onExit}
        />
      </StudyShell>
    );
  }

  return (
    <StudyShell
      mode="Practice"
      title={quiz.name}
      progress={(index + (answered ? 1 : 0)) / items.length}
      onExit={onExit}
      right={
        <>
          <AnimatePresence>
            {streak >= 2 && (
              <motion.span key={streak} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                <ShellStat icon={<Flame className="w-4 h-4" />} tone="text-orange-500">
                  {streak}
                </ShellStat>
              </motion.span>
            )}
          </AnimatePresence>
          <ShellStat>
            {index + 1}/{items.length}
          </ShellStat>
        </>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${round}-${index}`}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
          className="card p-6 sm:p-8 max-w-3xl mx-auto"
        >
          <ItemView item={item} given={given} revealed={answered} onAnswer={answer} />
          {answered && item.kind === "mcq" && (
            <Feedback correct={correct} answer={item.answer} explanation={item.explanation} onContinue={next} />
          )}
        </motion.div>
      </AnimatePresence>
      {!answered && <p className="mt-4 text-center text-xs text-muted hidden sm:block">Tip: press 1–4 to answer, Enter to continue</p>}
    </StudyShell>
  );
}
