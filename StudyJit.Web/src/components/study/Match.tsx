"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Play, Timer, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatTime, readBest, recordBest, sample, shuffle, studyPairs, type StudyQuiz } from "@/lib/study";
import Confetti from "@/components/ui/Confetti";
import StudyShell, { ShellStat } from "./StudyShell";

const PAIRS = 6;
const PENALTY = 1000;

interface Tile {
  id: string;
  pair: number;
  text: string;
  side: "term" | "definition";
}

/** Race the clock pairing each term with its definition; a wrong pair costs a second. */
export default function Match({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const pairs = useMemo(() => studyPairs(quiz), [quiz]);
  const bestKey = `match.${quiz.id}`;
  const [game, setGame] = useState(0);
  const tiles = useMemo<Tile[]>(() => {
    const chosen = sample(pairs, Math.min(PAIRS, pairs.length));
    return shuffle(
      chosen.flatMap((p, i) => [
        { id: `${game}-t${i}`, pair: i, text: p.term, side: "term" as const },
        { id: `${game}-d${i}`, pair: i, text: p.definition, side: "definition" as const },
      ])
    );
  }, [pairs, game]);

  const [started, setStarted] = useState(false);
  const [startAt, setStartAt] = useState(0);
  const [now, setNow] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<string[]>([]);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);

  const total = tiles.length / 2;
  const done = matched.size === total && started;
  const time = (finishedAt ?? now) - startAt + penalty;

  useEffect(() => {
    if (!started || finishedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [started, finishedAt]);

  useEffect(() => {
    if (done && finishedAt == null) {
      const end = Date.now();
      setFinishedAt(end);
      setNewBest(recordBest(bestKey, end - startAt + penalty, true));
    }
  }, [done, finishedAt, bestKey, startAt, penalty]);

  const start = () => {
    setGame((g) => g + 1);
    setStarted(true);
    setStartAt(Date.now());
    setNow(Date.now());
    setPenalty(0);
    setSelected(null);
    setMatched(new Set());
    setWrong([]);
    setFinishedAt(null);
    setNewBest(false);
  };

  const pick = (tile: Tile) => {
    if (matched.has(tile.pair) || wrong.length) return;
    if (!selected) return setSelected(tile);
    if (selected.id === tile.id) return setSelected(null);
    if (selected.pair === tile.pair && selected.side !== tile.side) {
      setMatched((m) => new Set(m).add(tile.pair));
      setSelected(null);
    } else {
      setWrong([selected.id, tile.id]);
      setPenalty((p) => p + PENALTY);
      setTimeout(() => {
        setWrong([]);
        setSelected(null);
      }, 450);
    }
  };

  const best = readBest(bestKey);

  if (!started || done) {
    return (
      <StudyShell mode="Match" title={quiz.name} onExit={onExit}>
        {done && newBest && <Confetti />}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card p-8 max-w-md mx-auto text-center">
          <span className="inline-flex w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 text-white items-center justify-center mb-4">
            {done ? <Trophy className="w-8 h-8" /> : <Timer className="w-8 h-8" />}
          </span>
          {done ? (
            <>
              <h2 className="text-3xl font-extrabold">{newBest ? "New record!" : "Nice matching!"}</h2>
              <p className="mt-3 text-5xl font-extrabold tabular-nums text-gradient">{formatTime(time)}</p>
              {penalty > 0 && <p className="mt-2 text-sm text-muted">Includes +{penalty / 1000}s for wrong pairs</p>}
              {best != null && !newBest && <p className="mt-1 text-sm text-muted">Your best: {formatTime(best)}</p>}
            </>
          ) : (
            <>
              <h2 className="text-3xl font-extrabold">Match</h2>
              <p className="mt-2 text-muted">
                Pair every term with its definition as fast as you can. Wrong pairs add a second.
              </p>
              {best != null && (
                <p className="mt-4 chip bg-amber-400/15 text-amber-600 dark:text-amber-400">
                  <Trophy className="w-3.5 h-3.5" /> Best {formatTime(best)}
                </p>
              )}
            </>
          )}
          <div className="mt-8 flex flex-col gap-3">
            <button onClick={start} className="btn-primary py-3 text-lg">
              <Play className="w-5 h-5" /> {done ? "Play again" : "Start game"}
            </button>
            {done && (
              <button onClick={onExit} className="btn-secondary">
                Back to study modes
              </button>
            )}
          </div>
        </motion.div>
      </StudyShell>
    );
  }

  return (
    <StudyShell
      mode="Match"
      title={quiz.name}
      progress={matched.size / total}
      onExit={onExit}
      right={
        <ShellStat icon={<Timer className="w-4 h-4" />} tone="text-foreground">
          {formatTime(time)}
        </ShellStat>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <AnimatePresence>
          {tiles.map((tile, i) =>
            matched.has(tile.pair) ? (
              <motion.div key={tile.id} className="min-h-28" exit={{ opacity: 0 }} />
            ) : (
              <motion.button
                key={tile.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  wrong.includes(tile.id)
                    ? { opacity: 1, scale: 1, x: [0, -8, 8, -6, 6, 0] }
                    : { opacity: 1, scale: selected?.id === tile.id ? 1.04 : 1 }
                }
                exit={{ opacity: 0, scale: 1.2, transition: { duration: 0.3 } }}
                transition={{ delay: wrong.length ? 0 : i * 0.025 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => pick(tile)}
                className={`min-h-28 rounded-2xl border-2 p-3 text-sm font-semibold leading-snug flex items-center justify-center text-center transition-colors ${
                  wrong.includes(tile.id)
                    ? "border-red-500 bg-red-500/10"
                    : selected?.id === tile.id
                    ? "border-brand bg-brand-soft text-brand shadow-lg"
                    : tile.side === "term"
                    ? "border-stroke bg-surface hover:border-brand/40"
                    : "border-stroke bg-surface-2 hover:border-brand/40 font-medium"
                }`}
              >
                <span className="line-clamp-5">{tile.text}</span>
              </motion.button>
            )
          )}
        </AnimatePresence>
      </div>
    </StudyShell>
  );
}
