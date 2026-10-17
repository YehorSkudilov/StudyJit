// Courses (StudyJit.Api's /api/courses): each holds folders of files, a study set made automatically for each folder,
// and exams combining study sets; plus the AI helpers that read a pasted course list and sort files into folders.

import { apiFetch } from "@/lib/api";

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
  folder_id: number | null;
  last_score: number | null;
  questions: unknown[];
  /** "set": a folder's study set; "exam": built from chosen study sets. */
  kind: "set" | "exam";
  source_ids: number[];
}

export interface CourseFolder {
  id: number;
  name: string;
  file_count: number;
}

export interface FolderPlan {
  name: string;
  file_ids: number[];
}

export interface CourseFile {
  id: number;
  name: string;
  course_id: number | null;
  folder_id: number | null;
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

export const deleteFiles = async (ids: number[]) => json(await send(`/api/items/files/delete`, "POST", { ids }), "Couldn't delete the files.");

/** The AI reads the courses out of pasted text; nothing is saved until they're created. */
export const parseCourses = async (text: string) =>
  (await json<{ courses: CourseDraft[] }>(await send("/api/ai/courses/parse", "POST", { text }), "The AI couldn't read that.")).courses;

export const deleteQuizzes = async (ids: number[]) =>
  json(await send("/api/items/quizzes/delete", "POST", { ids }), "Couldn't delete it.");

/** Queues a study set or exam to be generated again. */
export async function regenerate(quizId: number) {
  const form = new FormData();
  form.append("quizId", String(quizId));
  return json<{ status: string; queueNumber: number }>(await apiFetch("/api/ai/generateQuiz", { method: "POST", body: form }), "Couldn't start generating.");
}

// ---------- Folders (each folder with files is a study set) ----------

export const listFolders = async (courseId: number) =>
  json<CourseFolder[]>(await apiFetch(`/api/courses/${courseId}/folders`, { cache: "no-store" }), "Couldn't load the folders.");

export const createFolder = async (courseId: number, name: string) =>
  json<CourseFolder>(await send(`/api/courses/${courseId}/folders`, "POST", { name }), "Couldn't create the folder.");

export const renameFolder = async (courseId: number, folderId: number, name: string) =>
  json(await send(`/api/courses/${courseId}/folders/${folderId}`, "PATCH", { name }), "Couldn't rename the folder.");

export const deleteFolder = async (courseId: number, folderId: number) =>
  json(await send(`/api/courses/${courseId}/folders/${folderId}`, "DELETE"), "Couldn't delete the folder.");

export const moveFiles = async (courseId: number, fileIds: number[], folderId: number | null) =>
  json(await send(`/api/courses/${courseId}/files/move`, "POST", { file_ids: fileIds, folder_id: folderId }), "Couldn't move the files.");

/** The AI's suggested folders for the course's files; nothing moves until they're applied. */
export const organizeFiles = async (courseId: number) =>
  (await json<{ folders: FolderPlan[] }>(await send(`/api/ai/courses/${courseId}/organize`, "POST"), "The AI couldn't sort the files.")).folders;

export const applyFolders = async (courseId: number, folders: FolderPlan[]) =>
  json<CourseFolder[]>(await send(`/api/courses/${courseId}/folders/apply`, "POST", { folders }), "Couldn't apply the folders.");

/** An exam combining the chosen study sets, generated from their files and guides. */
export const createExam = async (courseId: number, exam: { name: string; set_ids: number[]; questions: number; focus: string }) =>
  (await json<{ created: QuizSummary[] }>(await send(`/api/ai/courses/${courseId}/exams`, "POST", exam), "Couldn't create the exam.")).created[0];

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

/** Downloads a YouTube video into the course (and folder), reporting progress from the server's events. */
export async function uploadYouTube(url: string, target: { courseId: number | null; folderId?: string | null }, onProgress?: (p: number) => void) {
  const res = await apiFetch("/api/items/files/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ url: url.trim(), folder: target.folderId ?? "root", course: target.courseId }),
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

/** The sections of a course page, which the navbar shows as tabs while you're in a course. */
export const courseSections = [
  { key: "", label: "Study sets" },
  { key: "exams", label: "Exams" },
  { key: "files", label: "Files" },
] as const;

export type CourseSection = (typeof courseSections)[number]["key"];

export const courseHref = (id: number, section: CourseSection = "") => (section ? `/courses/${id}/${section}` : `/courses/${id}`);
