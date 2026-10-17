"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Flame, Play, Timer, Trophy, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { pickFrom, readBest, recordAnswer, recordBest, statementItem, statementKey, type Item, type StudyQuiz } from "@/lib/study";
import Confetti from "@/components/ui/Confetti";
import Results from "./Results";
import StudyShell, { ShellStat } from "./StudyShell";

const DURATION = 60_000;

type TF = Extract<Item, { kind: "tf" }>;

/** A 60-second blitz of true-or-false statements. Right answers in a row build a multiplier. */
export default function TrueFalse({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const bestKey = `tf.${quiz.id}`;
  const deck = useRef<TF[]>([]);
  const [current, setCurrent] = useState<TF | null>(null);
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"ready" | "playing" | "over">("ready");
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const [points, setPoints] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const [log, setLog] = useState<{ item: TF; given: boolean }[]>([]);
  const [newBest, setNewBest] = useState(false);

  const draw = useCallback(() => {
    // Statements written for this format, new and missed ones first.
    if (deck.current.length === 0)
      deck.current = pickFrom(quiz.id, quiz.statements, statementKey, quiz.statements.length).map((s) => statementItem(s) as TF);
    setCurrent(deck.current.pop()!);
    setCount((c) => c + 1);
  }, [quiz.id, quiz.statements]);

  const start = () => {
    deck.current = [];
    setPoints(0);
    setCombo(0);
    setBestCombo(0);
    setLog([]);
    setNewBest(false);
    setEndsAt(Date.now() + DURATION);
    setNow(Date.now());
    setPhase("playing");
    draw();
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) setPhase("over");
    }, 100);
    return () => clearInterval(timer);
  }, [phase, endsAt]);

  useEffect(() => {
    if (phase === "over") setNewBest(recordBest(bestKey, points, false) && points > 0);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = useCallback(
    (value: boolean) => {
      if (phase !== "playing" || !current) return;
      const right = value === current.answer;
      if (current.hid) recordAnswer(quiz.id, current.hid, right);
      setLog((l) => [...l, { item: current, given: value }]);
      if (right) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        setBestCombo((b) => Math.max(b, nextCombo));
        setPoints((p) => p + 10 * multiplier(nextCombo));
      } else setCombo(0);
      setFlash(right ? "right" : "wrong");
      setTimeout(() => setFlash(null), 250);
      draw();
    },
    [phase, current, combo, draw, quiz.id]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "t") answer(true);
      if (e.key === "ArrowRight" || e.key === "f") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  const best = readBest(bestKey);

  if (phase === "ready") {
    return (
      <StudyShell mode="True or False" title={quiz.name} onExit={onExit}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card p-8 max-w-md mx-auto text-center">
          <span className="inline-flex w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-500 to-pink-500 text-white items-center justify-center mb-4">
            <Zap className="w-8 h-8" />
          </span>
          <h2 className="text-3xl font-extrabold">60-second blitz</h2>
          <p className="mt-2 text-muted">Is the answer right? Decide fast. Answer correctly in a row to multiply your points up to ×4.</p>
          {best != null && (
            <p className="mt-4 chip bg-amber-400/15 text-amber-600 dark:text-amber-400">
              <Trophy className="w-3.5 h-3.5" /> Best {best} pts
            </p>
          )}
          <p className="mt-4 text-xs text-muted hidden sm:block">← or T for true · → or F for false</p>
          <button onClick={start} className="btn-primary w-full mt-6 py-3 text-lg">
            <Play className="w-5 h-5" /> Start
          </button>
        </motion.div>
      </StudyShell>
    );
  }

  if (phase === "over") {
    const right = log.filter((l) => l.given === l.item.answer).length;
    return (
      <StudyShell mode="True or False" title={quiz.name} progress={1} onExit={onExit}>
        {newBest && <Confetti />}
        <Results
          percent={log.length ? (right / log.length) * 100 : 0}
          headline={`${points} points`}
          newBest={newBest}
          stats={[
            { label: "Answered", value: String(log.length) },
            { label: "Accuracy", value: `${log.length ? Math.round((right / log.length) * 100) : 0}%` },
            { label: "Best combo", value: String(bestCombo) },
          ]}
          review={log.map(({ item, given }) => ({
            prompt: item.statement,
            answer: item.answer ? "True" : "False",
            given: given ? "True" : "False",
            correct: given === item.answer,
            explanation: item.explanation,
          }))}
          onRetry={start}
          onDone={onExit}
        />
      </StudyShell>
    );
  }

  const left = Math.max(0, endsAt - now);
  return (
    <StudyShell
      mode="True or False"
      title={quiz.name}
      progress={1 - left / DURATION}
      onExit={onExit}
      right={
        <>
          <ShellStat icon={<Flame className="w-4 h-4" />} tone={combo >= 3 ? "text-orange-500" : "text-muted"}>
            ×{multiplier(combo)}
          </ShellStat>
          <ShellStat icon={<Timer className="w-4 h-4" />} tone={left < 10_000 ? "text-red-500" : "text-foreground"}>
            {Math.ceil(left / 1000)}s
          </ShellStat>
        </>
      }
    >
      <div className="max-w-2xl mx-auto">
        <motion.p key={points} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-center text-5xl font-extrabold tabular-nums text-gradient mb-6">
          {points}
        </motion.p>
        <AnimatePresence mode="popLayout">
          {current && (
            <motion.div
              key={count}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.95, transition: { duration: 0.15 } }}
              className={`card p-6 sm:p-8 transition-colors ${
                flash === "right" ? "!border-emerald-500" : flash === "wrong" ? "!border-red-500 animate-shake" : ""
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{current.prompt}</p>
              <p className="mt-3 text-2xl sm:text-3xl font-extrabold leading-snug">{current.statement}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => answer(true)}
            className="rounded-2xl py-5 text-xl font-extrabold text-white bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg flex items-center justify-center gap-2"
          >
            <Check className="w-6 h-6" /> True
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => answer(false)}
            className="rounded-2xl py-5 text-xl font-extrabold text-white bg-gradient-to-br from-rose-500 to-red-500 shadow-lg flex items-center justify-center gap-2"
          >
            <X className="w-6 h-6" /> False
          </motion.button>
        </div>
      </div>
    </StudyShell>
  );
}

function multiplier(combo: number) {
  return combo >= 9 ? 4 : combo >= 6 ? 3 : combo >= 3 ? 2 : 1;
}
