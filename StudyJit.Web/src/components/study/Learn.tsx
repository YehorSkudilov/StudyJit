"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Brain, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  isRight,
  mcqItem,
  sample,
  shuffle,
  trueFalseItem,
  typeable,
  writtenFromQuestion,
  writtenFromTerm,
  type Item,
  type StudyQuiz,
} from "@/lib/study";
import Confetti from "@/components/ui/Confetti";
import Feedback from "./Feedback";
import ItemView from "./ItemView";
import StudyShell, { ShellStat } from "./StudyShell";

const ROUND = 7;

/** Something to master: asked as multiple choice first, then in a harder form once that's right. */
interface Learnable {
  id: string;
  easy: () => Item;
  hard: () => Item;
}

function learnables(quiz: StudyQuiz): Learnable[] {
  const fromQuestions: Learnable[] = quiz.questions.map((q) => ({
    id: `q${q.id}`,
    easy: () => mcqItem(q),
    hard: () => (typeable(q) ? writtenFromQuestion(q) : trueFalseItem(q)),
  }));
  const terms = quiz.terms;
  const fromTerms: Learnable[] =
    terms.length >= 4
      ? terms.map((t, i) => ({
          id: `t${i}`,
          easy: () => ({
            kind: "mcq",
            key: `tm${i}`,
            prompt: t.definition,
            options: shuffle([t.term, ...sample(terms.filter((o) => o.term !== t.term), 3).map((o) => o.term)]),
            answer: t.term,
          }),
          hard: () => writtenFromTerm(t, i),
        }))
      : [];
  return shuffle([...fromQuestions, ...fromTerms]);
}

/**
 * Adaptive rounds: each item has to be answered right twice (multiple choice, then written or true/false) to be
 * mastered. Misses come back in a later round, and nothing is finished until everything is mastered.
 */
export default function Learn({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const [all, setAll] = useState<Learnable[]>(() => learnables(quiz));
  const [level, setLevel] = useState<Record<string, number>>({});
  const [round, setRound] = useState<{ l: Learnable; item: Item }[]>(() => nextRound(all, {}));
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<string | boolean | undefined>();
  const [override, setOverride] = useState(false);
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [between, setBetween] = useState(false);

  const total = all.length * 2;
  const points = useMemo(() => Object.values(level).reduce((a, b) => a + b, 0), [level]);
  const mastered = all.filter((l) => (level[l.id] ?? 0) >= 2).length;
  const finished = mastered === all.length;

  const current = round[index];
  const answered = given !== undefined;
  const correct = answered && (override || isRight(current.item, given));

  const answer = useCallback(
    (g: string | boolean) => {
      if (given !== undefined) return;
      setGiven(g);
      const right = isRight(current.item, g);
      setLevel((lv) => {
        const now = lv[current.l.id] ?? 0;
        return { ...lv, [current.l.id]: right ? Math.min(2, now + 1) : Math.max(0, now - 1) };
      });
      if (right) setRoundCorrect((c) => c + 1);
    },
    [current, given]
  );

  const markRight = () => {
    // A typed answer the checker didn't accept, that the student says was right: count it.
    setOverride(true);
    setLevel((lv) => ({ ...lv, [current.l.id]: Math.min(2, (lv[current.l.id] ?? 0) + 2) }));
    setRoundCorrect((c) => c + 1);
  };

  const next = useCallback(() => {
    setGiven(undefined);
    setOverride(false);
    if (index + 1 < round.length) setIndex(index + 1);
    else setBetween(true);
  }, [index, round.length]);

  const startRound = () => {
    setRound(nextRound(all, level));
    setIndex(0);
    setRoundCorrect(0);
    setBetween(false);
  };

  const restart = () => {
    const fresh = learnables(quiz);
    setAll(fresh);
    setLevel({});
    setRound(nextRound(fresh, {}));
    setIndex(0);
    setRoundCorrect(0);
    setBetween(false);
    setGiven(undefined);
  };

  const shell = (children: React.ReactNode) => (
    <StudyShell
      mode="Learn"
      title={quiz.name}
      progress={points / total}
      onExit={onExit}
      right={
        <ShellStat icon={<Brain className="w-4 h-4" />} tone="text-violet-500">
          {mastered}/{all.length} mastered
        </ShellStat>
      }
    >
      {children}
    </StudyShell>
  );

  if (between) {
    return shell(
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card p-8 max-w-xl mx-auto text-center">
        {finished && <Confetti />}
        <span className="inline-flex w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white items-center justify-center mb-4">
          {finished ? <Sparkles className="w-8 h-8" /> : <Brain className="w-8 h-8" />}
        </span>
        <h2 className="text-3xl font-extrabold">{finished ? "Everything mastered!" : "Round complete"}</h2>
        <p className="mt-2 text-muted">
          {finished
            ? `You've mastered all ${all.length} items. Try a Test to prove it.`
            : `${roundCorrect} of ${round.length} right this round. Keep going: misses come back until you've got them.`}
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-left">
          {[
            { label: "Mastered", value: mastered, color: "bg-emerald-500" },
            { label: "Learning", value: all.filter((l) => (level[l.id] ?? 0) === 1).length, color: "bg-amber-400" },
            { label: "Not yet", value: all.filter((l) => !(level[l.id] ?? 0)).length, color: "bg-stroke" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="rounded-xl bg-surface-2 p-3">
              <span className={`block w-2 h-2 rounded-full ${s.color} mb-2`} />
              <p className="text-2xl font-extrabold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3">
          {finished ? (
            <>
              <button onClick={restart} className="btn-primary">
                Learn it again
              </button>
              <button onClick={onExit} className="btn-secondary">
                Back to study modes
              </button>
            </>
          ) : (
            <button onClick={startRound} className="btn-primary py-3" autoFocus>
              Next round <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  const item = current.item;
  const answerText = item.kind === "tf" ? (item.answer ? "True" : `False: it's “${item.truth}”`) : item.answer;
  return shell(
    <>
      <div className="max-w-3xl mx-auto mb-4 flex gap-1.5">
        {round.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i < index ? "bg-brand" : i === index ? "bg-brand/50" : "bg-surface-2"}`}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.l.id}-${index}-${item.key}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.25 }}
          className="card p-6 sm:p-8 max-w-3xl mx-auto"
        >
          {(level[current.l.id] ?? 0) > 0 && !answered && (
            <span className="chip bg-violet-500/15 text-violet-600 dark:text-violet-400 mb-4">
              <Sparkles className="w-3 h-3" /> Level up: now without options
            </span>
          )}
          <ItemView item={item} given={given} revealed={answered} onAnswer={answer} />
          {answered && (
            <Feedback
              correct={correct}
              answer={answerText}
              given={item.kind === "written" ? String(given) : undefined}
              explanation={item.explanation}
              onContinue={next}
              onOverride={item.kind === "written" && !correct ? markRight : undefined}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/** The next round: the least-known items first, each asked at its level. */
function nextRound(all: Learnable[], level: Record<string, number>) {
  const open = all.filter((l) => (level[l.id] ?? 0) < 2);
  const ordered = [...shuffle(open)].sort((a, b) => (level[a.id] ?? 0) - (level[b.id] ?? 0));
  return ordered.slice(0, ROUND).map((l) => ({ l, item: (level[l.id] ?? 0) === 0 ? l.easy() : l.hard() }));
}
