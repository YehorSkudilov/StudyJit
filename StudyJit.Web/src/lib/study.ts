// What every study mode works from, as GET /api/items/quizzes/get/{id} returns it. The AI writes content for each way
// of studying: multiple-choice questions (Practice, Test, Learn), true-or-false statements (True or False, Test), short
// answers to type (Write, Test, Learn), exam-style written answers the AI marks (Exam answers), key terms (Flashcards, Match, Learn, Write), a study guide and a cheat sheet.

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

export interface Statement {
  id: number;
  statement: string;
  isTrue: boolean;
  explanation: string;
}

export interface ShortAnswer {
  id: number;
  question: string;
  answer: string;
  alternatives: string[];
  explanation: string;
}

/** An open question answered in sentences or code, marked by the AI against its key points. */
export interface WrittenAnswer {
  id: number;
  question: string;
  kind: "explain" | "code";
  modelAnswer: string;
  keyPoints: string[];
}

/** How the AI marked a written answer. */
export interface WrittenGrade {
  score: number;
  verdict: "correct" | "partial" | "incorrect";
  feedback: string;
  covered: string[];
  missed: string[];
}

export async function gradeWritten(id: number, answer: string): Promise<WrittenGrade> {
  const res = await apiFetch("/api/ai/gradeWritten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ written_answer_id: id, answer }),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 429) throw new Error("You've marked a lot of answers this hour. Try again a little later.");
  if (!res.ok) throw new Error(data?.error || "Couldn't mark this answer. Please try again.");
  return data;
}

export interface StudyQuiz {
  id: number;
  name: string;
  description: string;
  summary: string;
  cheatSheet: string;
  questions: Question[];
  terms: Term[];
  statements: Statement[];
  shortAnswers: ShortAnswer[];
  writtenAnswers: WrittenAnswer[];
  lastScore: number | null;
  status: string;
}

export type StudyMode = "learn" | "flashcards" | "practice" | "test" | "match" | "truefalse" | "write" | "answers" | "guide" | "cheatsheet";

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
    statements: (data.statements ?? []).map((s: { id: number; statement: string; is_true: boolean; explanation: string }) => ({
      id: s.id,
      statement: s.statement,
      isTrue: s.is_true,
      explanation: s.explanation,
    })),
    shortAnswers: data.short_answers ?? [],
    writtenAnswers: (data.written_answers ?? []).map(
      (w: { id: number; question: string; kind: "explain" | "code"; model_answer: string; key_points: string[] }) => ({
        id: w.id,
        question: w.question,
        kind: w.kind,
        modelAnswer: w.model_answer,
        keyPoints: w.key_points,
      })
    ),
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

// ---------- Question types for tests and Learn ----------

/** One thing to answer. hid keys its history (see recordAnswer); key terms have none. */
export type Item =
  | { kind: "mcq"; key: string; hid?: string; prompt: string; options: string[]; answer: string; explanation?: string }
  | { kind: "tf"; key: string; hid?: string; prompt: string; statement: string; answer: boolean; explanation?: string }
  | {
      kind: "written";
      key: string;
      hid?: string;
      prompt: string;
      answer: string;
      alternatives?: string[];
      explanation?: string;
      label?: string;
    };

export const questionKey = (q: Question) => `q${q.id}`;
export const statementKey = (s: Statement) => `s${s.id}`;
export const shortAnswerKey = (s: ShortAnswer) => `a${s.id}`;

export function mcqItem(q: Question): Item {
  return {
    kind: "mcq",
    key: questionKey(q),
    hid: questionKey(q),
    prompt: q.question,
    options: shuffle(q.options),
    answer: q.correct,
    explanation: q.explanation,
  };
}

/** A statement written to be judged true or false. */
export function statementItem(s: Statement): Item {
  return { kind: "tf", key: statementKey(s), hid: statementKey(s), prompt: "True or false?", statement: s.statement, answer: s.isTrue, explanation: s.explanation };
}

/** A question answered by typing a few words; its alternatives count too. */
export function shortAnswerItem(s: ShortAnswer): Item {
  return {
    kind: "written",
    key: shortAnswerKey(s),
    hid: shortAnswerKey(s),
    prompt: s.question,
    answer: s.answer,
    alternatives: s.alternatives,
    explanation: s.explanation,
  };
}

/** A key term to type from its definition. */
export function writtenFromTerm(t: Term, i: number): Item {
  return { kind: "written", key: `w${i}`, prompt: t.definition, answer: t.term, label: "Write the term" };
}

export function isRight(item: Item, given: string | boolean | undefined): boolean {
  if (given === undefined || given === "") return false;
  if (item.kind === "tf") return given === item.answer;
  if (item.kind === "mcq") return same(String(given), item.answer);
  return [item.answer, ...(item.alternatives ?? [])].some((a) => closeEnough(String(given), a));
}

/** The right answer as text, e.g. for feedback and reviews. */
export const answerText = (item: Item) => (item.kind === "tf" ? (item.answer ? "True" : "False") : item.answer);

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
export function recordAnswer(quizId: number, key: string, correct: boolean) {
  try {
    const history = readHistory(quizId);
    const entry = history[key] ?? { seen: 0, right: 0, wrong: 0 };
    history[key] = { seen: Date.now(), right: entry.right + (correct ? 1 : 0), wrong: entry.wrong + (correct ? 0 : 1) };
    localStorage.setItem(historyKey(quizId), JSON.stringify(history));
  } catch {
    // No storage: sessions are just random.
  }
}

/**
 * Picks a session's items from a bank: never-seen ones first, then ones answered wrong more than right, then the
 * longest since seen, with a little randomness so no two sessions are alike. Returned in random order.
 */
export function pickFrom<T>(quizId: number, items: T[], keyOf: (item: T) => string, size: number): T[] {
  if (items.length <= size) return shuffle(items);
  const history = readHistory(quizId);
  const now = Date.now();
  const score = (item: T) => {
    const h = history[keyOf(item)];
    if (!h) return 1000 + Math.random() * 100;
    const struggling = Math.max(0, h.wrong - h.right) * 50;
    const daysSince = (now - h.seen) / 86_400_000;
    return struggling + Math.min(daysSince, 30) * 5 + Math.random() * 40;
  };
  const ranked = items.map((item) => ({ item, s: score(item) })).sort((a, b) => b.s - a.s);
  return shuffle(ranked.slice(0, size).map((r) => r.item));
}

export const pickQuestions = (quizId: number, questions: Question[], size: number) => pickFrom(quizId, questions, questionKey, size);

/** How many questions one practice session takes from the bank. */
export const SESSION_SIZE = 15;
