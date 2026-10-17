import { BookOpenText, Brain, ClipboardCheck, Layers, PenLine, Puzzle, ScrollText, Target, Zap, type LucideIcon } from "lucide-react";
import type { StudyMode, StudyQuiz } from "@/lib/study";

export interface ModeInfo {
  mode: StudyMode;
  title: string;
  blurb: string;
  icon: LucideIcon;
  gradient: string;
  /** Why the mode can't run on this set, or null when it can. */
  unavailable: (quiz: StudyQuiz) => string | null;
}

const needsQuestions = (q: StudyQuiz) => (q.questions.length ? null : "Generate questions first");

export const modes: ModeInfo[] = [
  {
    mode: "learn",
    title: "Learn",
    blurb: "Adaptive rounds that repeat what you miss until it's mastered",
    icon: Brain,
    gradient: "from-violet-500 to-fuchsia-500",
    unavailable: needsQuestions,
  },
  {
    mode: "flashcards",
    title: "Flashcards",
    blurb: "Flip, swipe and sort into “know it” and “still learning”",
    icon: Layers,
    gradient: "from-sky-500 to-cyan-400",
    unavailable: (q) => (q.terms.length ? null : "Regenerate to get key terms"),
  },
  {
    mode: "practice",
    title: "Practice",
    blurb: "One question at a time with instant feedback",
    icon: Target,
    gradient: "from-emerald-500 to-teal-400",
    unavailable: needsQuestions,
  },
  {
    mode: "test",
    title: "Test",
    blurb: "Mixed question types, optional timer, graded at the end",
    icon: ClipboardCheck,
    gradient: "from-blue-600 to-indigo-500",
    unavailable: (q) => (q.questions.length || q.statements.length || q.shortAnswers.length ? null : "Generate questions first"),
  },
  {
    mode: "match",
    title: "Match",
    blurb: "Pair terms with definitions against the clock",
    icon: Puzzle,
    gradient: "from-amber-500 to-orange-500",
    unavailable: (q) => (q.terms.length >= 2 ? null : "Regenerate to get key terms"),
  },
  {
    mode: "truefalse",
    title: "True or False",
    blurb: "A 60-second blitz: build a combo, beat your best",
    icon: Zap,
    gradient: "from-rose-500 to-pink-500",
    unavailable: (q) => (q.statements.length ? null : "Regenerate to get true-or-false statements"),
  },
  {
    mode: "write",
    title: "Write",
    blurb: "Type answers from memory for the strongest recall",
    icon: PenLine,
    gradient: "from-lime-500 to-green-500",
    unavailable: (q) => (q.terms.length || q.shortAnswers.length ? null : "Regenerate to get written questions"),
  },
  {
    mode: "guide",
    title: "Study guide",
    blurb: "An AI summary and glossary of your material",
    icon: BookOpenText,
    gradient: "from-slate-600 to-slate-400",
    unavailable: (q) => (q.summary || q.terms.length ? null : "Regenerate to get a study guide"),
  },
  {
    mode: "cheatsheet",
    title: "Cheat sheet",
    blurb: "One printable page of the essentials",
    icon: ScrollText,
    gradient: "from-amber-500 to-yellow-400",
    unavailable: (q) => (q.cheatSheet ? null : "Regenerate to get a cheat sheet"),
  },
];

export const modeInfo = (mode: string) => modes.find((m) => m.mode === mode);

export const studyHref = (quizId: number, mode: StudyMode) => `/study/${quizId}/${mode}`;
