// Courses: what study sets and files are organised by (StudyJit.Api's /api/courses), plus the AI helpers that read a
// pasted course list and plan a course's study sets.

import { apiFetch } from "@/lib/api";
import type { Question, Term } from "@/lib/study";

export interface Course {
  id: number;
  code: string;
  name: string;
  term: string;
  color: string;
  quiz_count: number;
  ready_count: number;
  generating_count: number;
  file_count: number;
  average_score: number | null;
  created_at: string;
}

export interface CourseDraft {
  code: string;
  name: string;
  term: string;
}

export interface QuizSummary {
  id: number;
  name: string;
  description: string | null;
  generation_status: string;
  num_questions: number;
  course_id: number | null;
  last_score: number | null;
  questions: unknown[];
}

export interface CourseFile {
  id: number;
  name: string;
  course_id: number | null;
  size: number;
  mime_type: string | null;
  uploaded_at: string;
}

/** Each course colour as a gradient (for banners and icons) and a soft tint (for chips). */
export const courseColors: Record<string, { gradient: string; soft: string; text: string }> = {
  blue: { gradient: "from-blue-600 to-sky-400", soft: "bg-blue-500/12", text: "text-blue-600 dark:text-blue-400" },
  violet: { gradient: "from-violet-600 to-fuchsia-400", soft: "bg-violet-500/12", text: "text-violet-600 dark:text-violet-400" },
  emerald: { gradient: "from-emerald-600 to-teal-400", soft: "bg-emerald-500/12", text: "text-emerald-600 dark:text-emerald-400" },
  amber: { gradient: "from-amber-500 to-orange-400", soft: "bg-amber-500/12", text: "text-amber-600 dark:text-amber-400" },
  rose: { gradient: "from-rose-600 to-pink-400", soft: "bg-rose-500/12", text: "text-rose-600 dark:text-rose-400" },
  cyan: { gradient: "from-cyan-600 to-teal-300", soft: "bg-cyan-500/12", text: "text-cyan-600 dark:text-cyan-400" },
  indigo: { gradient: "from-indigo-600 to-blue-400", soft: "bg-indigo-500/12", text: "text-indigo-600 dark:text-indigo-400" },
  orange: { gradient: "from-orange-600 to-amber-400", soft: "bg-orange-500/12", text: "text-orange-600 dark:text-orange-400" },
};

export const colorOf = (course: { color: string }) => courseColors[course.color] ?? courseColors.blue;

export const courseTitle = (c: { code: string; name: string }) => (c.code ? `${c.code} · ${c.name}` : c.name);

async function json<T>(res: Response, fallback: string): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || fallback);
  return body as T;
}

const send = (path: string, method: string, body?: unknown) =>
  apiFetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const listCourses = async () => json<Course[]>(await apiFetch("/api/courses", { cache: "no-store" }), "Couldn't load your courses.");

export const getCourse = async (id: number) => json<Course>(await apiFetch(`/api/courses/${id}`, { cache: "no-store" }), "Couldn't load this course.");

export const createCourse = async (draft: CourseDraft & { color?: string }) =>
  json<Course>(await send("/api/courses", "POST", draft), "Couldn't create the course.");

export const createCourses = async (drafts: CourseDraft[]) =>
  json<Course[]>(await send("/api/courses/bulk", "POST", { courses: drafts }), "Couldn't create the courses.");

export const updateCourse = async (id: number, fields: Partial<CourseDraft & { color: string }>) =>
  json<Course>(await send(`/api/courses/${id}`, "PATCH", fields), "Couldn't save the course.");

export const deleteCourse = async (id: number) => json(await send(`/api/courses/${id}`, "DELETE"), "Couldn't delete the course.");

export const courseQuizzes = async (id: number | "all") =>
  json<QuizSummary[]>(await apiFetch(`/api/items/quizzes/getAll?course=${id}`, { cache: "no-store" }), "Couldn't load the study sets.");

export const courseFiles = async (id: number) =>
  json<CourseFile[]>(await apiFetch(`/api/items/files?course=${id}`, { cache: "no-store" }), "Couldn't load the files.");

export const allFiles = async () => json<CourseFile[]>(await apiFetch(`/api/items/files`, { cache: "no-store" }), "Couldn't load the files.");

export const attachFiles = async (courseId: number, fileIds: number[]) =>
  json(await send(`/api/courses/${courseId}/files`, "POST", { file_ids: fileIds }), "Couldn't add the files.");

export const deleteFiles = async (ids: number[]) => json(await send(`/api/items/files/delete`, "POST", { ids }), "Couldn't delete the files.");

export async function createQuiz(name: string, description: string, courseId: number | null) {
  return json<{ quizId: number }>(
    await send("/api/items/quizzes/create", "POST", { name, description, course_id: courseId }),
    "Couldn't create the study set."
  );
}

/** The AI reads the courses out of pasted text; nothing is saved until they're created. */
export const parseCourses = async (text: string) =>
  (await json<{ courses: CourseDraft[] }>(await send("/api/ai/courses/parse", "POST", { text }), "The AI couldn't read that.")).courses;

/** Course autopilot: the AI plans the course's study sets and queues them all for generation. */
export const autopilot = async (courseId: number, sets: number) =>
  (await json<{ created: QuizSummary[] }>(await send(`/api/ai/courses/${courseId}/autopilot`, "POST", { sets }), "Autopilot couldn't start."))
    .created;

/** Uploads a file in 5 MB chunks, into a course (and/or a files folder). */
export async function uploadFile(file: File, target: { courseId?: number | null; folderId?: string | null }, onProgress?: (p: number) => void) {
  const CHUNK = 5 * 1024 * 1024;
  let start = 0;
  // An empty file is still one (empty) chunk.
  do {
    const end = Math.min(start + CHUNK, file.size);
    const headers: Record<string, string> = {
      "Content-Range": `bytes ${start}-${Math.max(end - 1, start)}/${Math.max(file.size, 1)}`,
      "X-Filename": encodeURIComponent(file.name),
      "X-Folder": target.folderId ?? "root",
    };
    if (target.courseId != null) headers["X-Course"] = String(target.courseId);
    const res = await apiFetch("/api/items/files/upload", { method: "POST", headers, body: file.slice(start, end) });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Uploading ${file.name} failed.`);
    start = end;
    onProgress?.(file.size ? Math.round((end / file.size) * 100) : 100);
  } while (start < file.size);
}

/** Downloads a YouTube video into the course, reporting progress from the server's events. */
export async function uploadYouTube(url: string, courseId: number | null, onProgress?: (p: number) => void) {
  const res = await apiFetch("/api/items/files/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ url: url.trim(), folder: "root", course: courseId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "YouTube download failed.");
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream.");
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const event = JSON.parse(line.slice(5).trim());
      if (event.status === "error") throw new Error(event.error || "Download failed.");
      if (event.percent !== undefined) onProgress?.(event.percent);
      if (event.status === "complete") return;
    }
  }
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(0)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(2)} GB`;
}

// ---------- Course-wide study and cheat sheets ----------

export interface CheatSheet {
  id: number;
  title: string;
  focus: string;
  content: string;
  created_at: string;
}

/** Every generated set's questions and key terms together, for studying the whole course at once. */
export const courseStudy = async (id: number) =>
  json<{ id: number; name: string; set_count: number; questions: Question[]; terms: Term[] }>(
    await apiFetch(`/api/courses/${id}/study`, { cache: "no-store" }),
    "Couldn't load this course's material."
  );

export const cheatSheets = async (id: number) =>
  json<CheatSheet[]>(await apiFetch(`/api/courses/${id}/cheatsheets`, { cache: "no-store" }), "Couldn't load the cheat sheets.");

export const createCheatSheet = async (id: number, focus: string, detailed: boolean) =>
  json<CheatSheet>(await send(`/api/courses/${id}/cheatsheets`, "POST", { focus, detailed }), "Couldn't write the cheat sheet.");

export const deleteCheatSheet = async (id: number, sheetId: number) =>
  json(await send(`/api/courses/${id}/cheatsheets/${sheetId}`, "DELETE"), "Couldn't delete the cheat sheet.");

/** The sections of a course page, which the navbar shows as tabs while you're in a course. */
export const courseSections = [
  { key: "", label: "Overview" },
  { key: "sets", label: "Study sets" },
  { key: "flashcards", label: "Flashcards" },
  { key: "cheatsheets", label: "Cheat sheets" },
  { key: "exam", label: "Exam prep" },
  { key: "files", label: "Files" },
] as const;

export type CourseSection = (typeof courseSections)[number]["key"];

export const courseHref = (id: number, section: CourseSection = "") => (section ? `/courses/${id}/${section}` : `/courses/${id}`);
