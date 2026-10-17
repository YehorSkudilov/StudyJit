// What every study mode works from: a quiz's questions (multiple choice, each with an explanation), its key terms and
// its study guide, as GET /api/items/quizzes/get/{id} returns them. Quizzes generated before terms existed have none, so
// the term-based modes fall back to question → answer pairs.

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

export interface Question {
  id: number;
  question: string;
  options: string[];
  correct: string;
  explanation?: string;
}

export interface Term {
  term: string;
  definition: string;
}

export interface StudyQuiz {
  id: number;
  name: string;
  description: string;
  summary: string;
  cheatSheet: string;
  questions: Question[];
  terms: Term[];
  lastScore: number | null;
  status: string;
}

export type StudyMode = "learn" | "flashcards" | "practice" | "test" | "match" | "truefalse" | "write" | "guide" | "cheatsheet";

export async function loadQuiz(id: number): Promise<StudyQuiz> {
  const res = await apiFetch(`/api/items/quizzes/get/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Couldn't load this study set.");
  return {
    id: data.id,
    name: data.name,
    description: data.description ?? "",
    summary: data.summary ?? "",
    cheatSheet: data.cheat_sheet ?? "",
    questions: data.questions ?? [],
    terms: data.terms ?? [],
    lastScore: data.last_score ?? null,
    status: data.generation_status,
  };
}

export function useStudyQuiz(key: string) {
  const [quiz, setQuiz] = useState<StudyQuiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const id = Number(key);
    if (Number.isNaN(id)) return;
    let live = true;
    loadQuiz(id).then(
      (q) => live && setQuiz(q),
      (e) => live && setError((e as Error).message)
    );
    return () => {
      live = false;
    };
  }, [key]);
  return { quiz, error };
}

/** Records a percentage as the quiz's last score (what the learning space shows). */
export async function saveScore(quizId: number, percent: number) {
  try {
    await apiFetch("/api/items/quizzes/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: quizId, lastScore: Math.round(percent * 100) / 100 }),
    });
  } catch {
    // The score is a nicety; studying goes on without it.
  }
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sample<T>(items: readonly T[], count: number): T[] {
  return shuffle(items).slice(0, count);
}

/** Term/definition pairs: the quiz's key terms, or its questions and answers when it has none. */
export function studyPairs(quiz: StudyQuiz): Term[] {
  if (quiz.terms.length >= 4) return quiz.terms;
  return quiz.questions.map((q) => ({ term: q.correct, definition: q.question }));
}

/** Whether the pairs are real key terms (vs. questions standing in for them), for wording. */
export const hasTerms = (quiz: StudyQuiz) => quiz.terms.length >= 4;

// ---------- Question types for tests and Learn ----------

/** One thing to answer; qid is the bank question it came from, when it did (key terms have none). */
export type Item =
  | { kind: "mcq"; key: string; qid?: number; prompt: string; options: string[]; answer: string; explanation?: string }
  | { kind: "tf"; key: string; qid?: number; prompt: string; statement: string; answer: boolean; truth: string; explanation?: string }
  | { kind: "written"; key: string; qid?: number; prompt: string; answer: string; explanation?: string; label?: string };

export function mcqItem(q: Question): Item {
  return {
    kind: "mcq",
    key: `q${q.id}`,
    qid: q.id,
    prompt: q.question,
    options: shuffle(q.options),
    answer: q.correct,
    explanation: q.explanation,
  };
}

/** "Q? — A" is true half the time; otherwise a wrong option takes the answer's place. */
export function trueFalseItem(q: Question): Item {
  const isTrue = Math.random() < 0.5;
  const wrong = q.options.filter((o) => !same(o, q.correct));
  const shown = isTrue || wrong.length === 0 ? q.correct : wrong[Math.floor(Math.random() * wrong.length)];
  return {
    kind: "tf",
    key: `tf${q.id}`,
    qid: q.id,
    prompt: q.question,
    statement: shown,
    answer: isTrue || wrong.length === 0,
    truth: q.correct,
    explanation: q.explanation,
  };
}

export function writtenFromTerm(t: Term, i: number): Item {
  return { kind: "written", key: `w${i}`, prompt: t.definition, answer: t.term, label: "Write the term" };
}

export function writtenFromQuestion(q: Question): Item {
  return { kind: "written", key: `wq${q.id}`, qid: q.id, prompt: q.question, answer: q.correct, explanation: q.explanation };
}

/** Questions short enough to answer by typing. */
export const typeable = (q: Question) => q.correct.length <= 40 && q.correct.split(/\s+/).length <= 5;

export function isRight(item: Item, given: string | boolean | undefined): boolean {
  if (given === undefined || given === "") return false;
  if (item.kind === "tf") return given === item.answer;
  if (item.kind === "mcq") return same(String(given), item.answer);
  return closeEnough(String(given), item.answer);
}

// ---------- Comparing typed answers ----------

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

/** Typed answers forgive case, accents, punctuation, articles and a small typo or two. */
export function closeEnough(given: string, expected: string) {
  const g = normalize(given);
  const e = normalize(expected);
  if (!g) return false;
  if (g === e) return true;
  const allowed = e.length <= 4 ? 0 : e.length <= 8 ? 1 : Math.floor(e.length * 0.15);
  return distance(g, e) <= allowed;
}

// ---------- Personal bests (per browser) ----------

export function readBest(key: string): number | null {
  try {
    const v = localStorage.getItem(`studyjit.best.${key}`);
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
}

/** Saves the value if it beats the stored one; lower is better for times. Returns whether it's a new best. */
export function recordBest(key: string, value: number, lowerIsBetter: boolean): boolean {
  const best = readBest(key);
  const better = best == null || (lowerIsBetter ? value < best : value > best);
  if (better) {
    try {
      localStorage.setItem(`studyjit.best.${key}`, String(value));
    } catch {
      // No storage: no personal bests.
    }
  }
  return better;
}

export function formatTime(ms: number) {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = (total % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

// ---------- Sessions: a different mix from the question bank each time ----------

type History = Record<string, { seen: number; right: number; wrong: number }>;

const historyKey = (quizId: number) => `studyjit.history.${quizId}`;

function readHistory(quizId: number): History {
  try {
    return JSON.parse(localStorage.getItem(historyKey(quizId)) ?? "{}") as History;
  } catch {
    return {};
  }
}

/** Remembers how a question went (in this browser), so later sessions favour what's new or was missed. */
export function recordAnswer(quizId: number, questionId: number, correct: boolean) {
  try {
    const history = readHistory(quizId);
    const entry = history[questionId] ?? { seen: 0, right: 0, wrong: 0 };
    history[questionId] = { seen: Date.now(), right: entry.right + (correct ? 1 : 0), wrong: entry.wrong + (correct ? 0 : 1) };
    localStorage.setItem(historyKey(quizId), JSON.stringify(history));
  } catch {
    // No storage: sessions are just random.
  }
}

/**
 * Picks a session's questions from the bank: never-seen ones first, then ones answered wrong more than right, then
 * the longest since seen, with a little randomness so no two sessions are alike. Returned in random order.
 */
export function pickQuestions(quizId: number, questions: Question[], size: number): Question[] {
  if (questions.length <= size) return shuffle(questions);
  const history = readHistory(quizId);
  const now = Date.now();
  const score = (q: Question) => {
    const h = history[q.id];
    if (!h) return 1000 + Math.random() * 100;
    const struggling = Math.max(0, h.wrong - h.right) * 50;
    const daysSince = (now - h.seen) / 86_400_000;
    return struggling + Math.min(daysSince, 30) * 5 + Math.random() * 40;
  };
  const ranked = questions.map((q) => ({ q, s: score(q) })).sort((a, b) => b.s - a.s);
  return shuffle(ranked.slice(0, size).map((r) => r.q));
}

/** How many questions one practice session takes from the bank. */
export const SESSION_SIZE = 15;
