"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";
import { isRight, pickFrom, recordAnswer, shortAnswerItem, shortAnswerKey, shuffle, writtenFromTerm, type Item, type StudyQuiz } from "@/lib/study";
import Feedback from "./Feedback";
import ItemView from "./ItemView";
import Results, { type ReviewRow } from "./Results";
import StudyShell, { ShellStat } from "./StudyShell";

/** A round: short-answer questions written for typing (new and missed first) mixed with key terms to recall. */
function buildItems(quiz: StudyQuiz): Item[] {
  const answers = pickFrom(quiz.id, quiz.shortAnswers, shortAnswerKey, 15).map(shortAnswerItem);
  const terms = shuffle(quiz.terms.map(writtenFromTerm)).slice(0, Math.max(10, 25 - answers.length));
  return shuffle([...answers, ...terms]);
}

/** Recall without options: answer short questions and name terms from their definitions by typing. */
export default function Write({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const [items, setItems] = useState<Item[]>(() => buildItems(quiz));
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<string | undefined>();
  const [results, setResults] = useState<ReviewRow[]>([]);
  const [done, setDone] = useState(false);

  const item = items[index];
  const answered = given !== undefined;
  const last = results[results.length - 1];

  const answer = useCallback(
    (g: string | boolean) => {
      if (given !== undefined || !item) return;
      const text = String(g);
      setGiven(text);
      if (item.hid) recordAnswer(quiz.id, item.hid, isRight(item, text));
      setResults((r) => [...r, { prompt: item.prompt, answer: String(item.answer), given: text, correct: isRight(item, text), explanation: item.explanation }]);
    },
    [given, item, quiz.id]
  );

  const next = useCallback(() => {
    setGiven(undefined);
    if (index + 1 < items.length) setIndex(index + 1);
    else setDone(true);
  }, [index, items.length]);

  const restart = (list: Item[]) => {
    setItems(shuffle(list));
    setRound((r) => r + 1);
    setIndex(0);
    setGiven(undefined);
    setResults([]);
    setDone(false);
  };

  if (items.length === 0) {
    return (
      <StudyShell mode="Write" title={quiz.name} onExit={onExit}>
        <div className="card p-8 max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold">Nothing to write yet</h2>
          <p className="mt-2 text-muted">This set&apos;s answers are too long to type. Regenerate it to get key terms for Write mode.</p>
          <button onClick={onExit} className="btn-primary mt-6">
            Back to study modes
          </button>
        </div>
      </StudyShell>
    );
  }

  const score = results.filter((r) => r.correct).length;

  if (done) {
    const missed = new Set(results.filter((r) => !r.correct).map((r) => r.prompt));
    return (
      <StudyShell mode="Write" title={quiz.name} progress={1} onExit={onExit}>
        <Results
          percent={(score / items.length) * 100}
          stats={[
            { label: "Correct", value: `${score}/${items.length}` },
            { label: "Missed", value: String(items.length - score) },
            { label: "Round", value: String(round + 1) },
          ]}
          review={results}
          onRetry={() => restart(buildItems(quiz))}
          onRetryMissed={() => restart(items.filter((i) => missed.has(i.prompt)))}
          onDone={onExit}
        />
      </StudyShell>
    );
  }

  return (
    <StudyShell
      mode="Write"
      title={quiz.name}
      progress={(index + (answered ? 1 : 0)) / items.length}
      onExit={onExit}
      right={
        <ShellStat>
          {index + 1}/{items.length}
        </ShellStat>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${round}-${index}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.25 }}
          className="card p-6 sm:p-8 max-w-3xl mx-auto"
        >
          <ItemView item={item} given={given} revealed={answered} onAnswer={answer} />
          {answered && last && (
            <Feedback
              correct={last.correct}
              answer={String(item.answer)}
              given={given}
              explanation={item.explanation}
              onContinue={next}
              onOverride={
                last.correct
                  ? undefined
                  : () => setResults((r) => r.map((row, i) => (i === r.length - 1 ? { ...row, correct: true } : row)))
              }
            />
          )}
        </motion.div>
      </AnimatePresence>
    </StudyShell>
  );
}
