"use client";

import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Check, Repeat, RotateCcw, Shuffle, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { hasTerms, shuffle, studyPairs, type StudyQuiz, type Term } from "@/lib/study";
import Confetti from "@/components/ui/Confetti";
import StudyShell, { ShellStat } from "./StudyShell";

/**
 * Cards to flip (click or Space) and sort: swipe or press → for "know it", ← for "still learning". At the end the
 * "still learning" pile can go round again until it's empty.
 */
export default function Flashcards({ quiz, onExit }: { quiz: StudyQuiz; onExit: () => void }) {
  const all = studyPairs(quiz);
  const [deck, setDeck] = useState<Term[]>(() => shuffle(all));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [termFirst, setTermFirst] = useState(hasTerms(quiz));
  const [known, setKnown] = useState<Term[]>([]);
  const [learning, setLearning] = useState<Term[]>([]);
  const [history, setHistory] = useState<boolean[]>([]);
  const [exitDir, setExitDir] = useState(0);

  const card = deck[index];
  const finished = index >= deck.length;

  const sort = useCallback(
    (know: boolean) => {
      if (!card) return;
      setExitDir(know ? 1 : -1);
      (know ? setKnown : setLearning)((pile) => [...pile, card]);
      setHistory((h) => [...h, know]);
      setFlipped(false);
      setIndex((i) => i + 1);
    },
    [card]
  );

  const undo = useCallback(() => {
    if (index === 0) return;
    const last = history[history.length - 1];
    (last ? setKnown : setLearning)((pile) => pile.slice(0, -1));
    setHistory((h) => h.slice(0, -1));
    setExitDir(0);
    setFlipped(false);
    setIndex((i) => i - 1);
  }, [history, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") sort(true);
      else if (e.key === "ArrowLeft") sort(false);
      else if (e.key === "z" || e.key === "Backspace") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, sort, undo]);

  const restart = (cards: Term[]) => {
    setDeck(shuffle(cards));
    setIndex(0);
    setKnown([]);
    setLearning([]);
    setHistory([]);
    setFlipped(false);
    setExitDir(0);
  };

  const front = card ? (termFirst ? card.term : card.definition) : "";
  const back = card ? (termFirst ? card.definition : card.term) : "";

  return (
    <StudyShell
      mode="Flashcards"
      title={quiz.name}
      progress={index / deck.length}
      onExit={onExit}
      right={
        <>
          <ShellStat icon={<RotateCcw className="w-3.5 h-3.5" />} tone="text-orange-500">
            {learning.length}
          </ShellStat>
          <ShellStat icon={<Check className="w-3.5 h-3.5" />} tone="text-emerald-500">
            {known.length}
          </ShellStat>
        </>
      }
    >
      {finished ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card p-8 max-w-lg mx-auto text-center">
          {learning.length === 0 && <Confetti />}
          <p className="text-5xl mb-3">{learning.length === 0 ? "🎉" : "💪"}</p>
          <h2 className="text-3xl font-extrabold">{learning.length === 0 ? "You know them all!" : "Round complete"}</h2>
          <p className="mt-2 text-muted">
            {known.length} known · {learning.length} still learning
          </p>
          <div className="mt-6 h-3 rounded-full bg-surface-2 overflow-hidden flex">
            <motion.div
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${(known.length / deck.length) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
            <motion.div
              className="h-full bg-orange-400"
              initial={{ width: 0 }}
              animate={{ width: `${(learning.length / deck.length) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
          <div className="mt-8 flex flex-col gap-3">
            {learning.length > 0 && (
              <button onClick={() => restart(learning)} className="btn-primary">
                <Repeat className="w-4 h-4" /> Study {learning.length} still learning
              </button>
            )}
            <button onClick={() => restart(all)} className={learning.length > 0 ? "btn-secondary" : "btn-primary"}>
              <RotateCcw className="w-4 h-4" /> Restart all {all.length} cards
            </button>
            <button onClick={onExit} className="btn-ghost">
              Back to study modes
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <div className="relative h-[22rem] sm:h-[24rem] perspective">
            <AnimatePresence custom={exitDir} initial={false}>
              <SwipeCard
                key={`${index}-${card.term}`}
                front={front}
                back={back}
                frontLabel={termFirst ? (hasTerms(quiz) ? "Term" : "Answer") : hasTerms(quiz) ? "Definition" : "Question"}
                backLabel={termFirst ? (hasTerms(quiz) ? "Definition" : "Question") : hasTerms(quiz) ? "Term" : "Answer"}
                flipped={flipped}
                onFlip={() => setFlipped((f) => !f)}
                onSwipe={sort}
                exitDir={exitDir}
              />
            </AnimatePresence>
          </div>

          <div className="mt-8 flex items-center justify-center gap-4">
            <button onClick={undo} disabled={index === 0} className="icon-btn" title="Undo (Z)">
              <Undo2 className="w-5 h-5" />
            </button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => sort(false)}
              className="w-16 h-16 rounded-full border-2 border-orange-400 text-orange-500 flex items-center justify-center hover:bg-orange-400/10 transition"
              title="Still learning (←)"
            >
              <X className="w-7 h-7" />
            </motion.button>
            <span className="w-20 text-center font-bold tabular-nums text-muted">
              {index + 1} / {deck.length}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => sort(true)}
              className="w-16 h-16 rounded-full border-2 border-emerald-500 text-emerald-500 flex items-center justify-center hover:bg-emerald-500/10 transition"
              title="Know it (→)"
            >
              <Check className="w-7 h-7" />
            </motion.button>
            <button
              onClick={() => {
                setTermFirst(!termFirst);
                setFlipped(false);
              }}
              className="icon-btn"
              title="Swap front and back"
            >
              <Shuffle className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-5 text-center text-xs text-muted hidden sm:block">
            Space to flip · → know it · ← still learning · Z to undo
          </p>
        </div>
      )}
    </StudyShell>
  );
}

function SwipeCard({
  front,
  back,
  frontLabel,
  backLabel,
  flipped,
  onFlip,
  onSwipe,
  exitDir,
}: {
  front: string;
  back: string;
  frontLabel: string;
  backLabel: string;
  flipped: boolean;
  onFlip: () => void;
  onSwipe: (know: boolean) => void;
  exitDir: number;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
  const knowOpacity = useTransform(x, [20, 120], [0, 1]);
  const learnOpacity = useTransform(x, [-120, -20], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110 || info.velocity.x > 600) onSwipe(true);
    else if (info.offset.x < -110 || info.velocity.x < -600) onSwipe(false);
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      // The direction comes from AnimatePresence's custom, so the leaving card flies the way it was sorted.
      variants={{ leave: (dir: number) => ({ x: dir * 500, opacity: 0, rotate: dir * 20, transition: { duration: 0.3 } }) }}
      exit="leave"
      custom={exitDir}
    >
      <motion.div
        className="relative w-full h-full preserve-3d"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        onTap={onFlip}
      >
        <Face label={frontLabel} text={front} />
        <Face label={backLabel} text={back} back />
      </motion.div>
      <motion.span
        style={{ opacity: knowOpacity }}
        className="pointer-events-none absolute top-6 left-6 chip text-base px-4 py-2 border-2 border-emerald-500 text-emerald-500 bg-surface -rotate-12"
      >
        KNOW IT
      </motion.span>
      <motion.span
        style={{ opacity: learnOpacity }}
        className="pointer-events-none absolute top-6 right-6 chip text-base px-4 py-2 border-2 border-orange-400 text-orange-500 bg-surface rotate-12"
      >
        STILL LEARNING
      </motion.span>
    </motion.div>
  );
}

function Face({ label, text, back }: { label: string; text: string; back?: boolean }) {
  const long = text.length > 140;
  return (
    <div
      className={`absolute inset-0 backface-hidden card flex flex-col p-6 sm:p-8 ${
        back ? "[transform:rotateY(180deg)] bg-gradient-to-br from-brand-soft to-surface" : ""
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wider text-brand">{label}</span>
      <div className="flex-1 flex items-center justify-center overflow-y-auto">
        <p className={`text-center font-bold leading-snug ${long ? "text-lg" : text.length > 60 ? "text-2xl" : "text-3xl sm:text-4xl"}`}>{text}</p>
      </div>
      <span className="text-center text-xs text-muted">Tap to flip</span>
    </div>
  );
}
