"use client";
import { apiFetch } from "@/lib/api";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, Check, ChevronLeft, ClipboardCheck, FileText, Folder, Loader2, Lock, RefreshCw, Trash2, Wand2 } from "lucide-react";
import AlertPopup from "@/components/AlertPopup";
import ScoreRing from "@/components/ui/ScoreRing";
import GenerationProgress, { type GenerationProgressInfo } from "@/components/GenerationProgress";
import { loadQuiz, type StudyQuiz } from "@/lib/study";
import { modes, studyHref } from "@/lib/modes";
import {
  courseFiles,
  courseHref,
  courseQuizzes,
  courseTitle,
  deleteQuizzes,
  getCourse,
  listFolders,
  regenerate,
  type Course,
  type CourseFile,
  type CourseFolder,
  type QuizSummary,
} from "@/lib/courses";

type GenerationStatus = "never_generated" | "queued" | "pending" | "success" | "failed" | null;

interface Detail {
  name: string;
  description: string;
  status: GenerationStatus;
  lastScore: number | null;
  queueNumber: number | null;
  courseId: number | null;
  folderId: number | null;
  kind: "set" | "exam";
  sourceIds: number[];
  progress: GenerationProgressInfo | null;
}

/**
 * A study set (made from one of the course's folders) or an exam (made from chosen study sets): its study modes, what
 * it's made from, and regenerating it.
 */
export default function QuizDetailsPage() {
  const router = useRouter();
  const [quizId, setQuizId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [quiz, setQuiz] = useState<StudyQuiz | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [folder, setFolder] = useState<CourseFolder | null>(null);
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [sources, setSources] = useState<QuizSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const generating = detail?.status === "queued" || detail?.status === "pending";

  const refresh = useCallback(async (id: number) => {
    const res = await apiFetch(`/api/items/quizzes/get/${id}`);
    if (!res.ok) throw new Error("Couldn't load this study set.");
    const data = await res.json();
    const d: Detail = {
      name: data.name,
      description: data.description ?? "",
      status: data.generation_status ?? null,
      lastScore: data.last_score ?? null,
      queueNumber: data.queue_number ?? null,
      progress: data.progress ?? null,
      courseId: data.course_id ?? null,
      folderId: data.folder_id ?? null,
      kind: data.kind ?? "set",
      sourceIds: data.source_ids ?? [],
    };
    setDetail(d);
    setQuiz(await loadQuiz(id));
    if (d.courseId) {
      sessionStorage.setItem("currentCourseId", String(d.courseId));
      sessionStorage.setItem("currentCourseSection", d.kind === "exam" ? "exams" : "");
      window.dispatchEvent(new Event("studyjit-course"));
      const [c, allFiles, folders, quizzes] = await Promise.all([getCourse(d.courseId), courseFiles(d.courseId), listFolders(d.courseId), courseQuizzes(d.courseId)]);
      setCourse(c);
      setFolder(folders.find((f) => f.id === d.folderId) ?? null);
      setFiles(allFiles.filter((f) => d.folderId != null && f.folder_id === d.folderId));
      setSources(quizzes.filter((q) => d.sourceIds.includes(q.id)));
    }
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("selectedQuizId");
    if (!stored) {
      router.push("/courses");
      return;
    }
    const id = Number(stored);
    setQuizId(id);
    refresh(id).catch((e) => setAlert(e.message));
  }, [router, refresh]);

  // While it's generating, check back until it's done.
  useEffect(() => {
    if (!quizId || !generating) return;
    const timer = setInterval(() => refresh(quizId).catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [quizId, generating, refresh]);

  const regenerateNow = async () => {
    if (!quizId) return;
    setBusy(true);
    try {
      await regenerate(quizId);
      await refresh(quizId);
    } catch (e) {
      setAlert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const back = course ? courseHref(course.id, detail?.kind === "exam" ? "exams" : "") : "/courses";
  const hasQuestions = (quiz?.questions.length ?? 0) > 0;
  const sourceCount = sources.length || detail?.sourceIds.length || 0;

  return (
    <div className="page">
      {alert && <AlertPopup message={alert} onClose={() => setAlert(null)} />}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <button onClick={() => router.push(back)} className="btn-ghost -ml-3 mb-4 px-3 py-1.5 text-sm">
          <ChevronLeft className="w-4 h-4" /> {course ? `${courseTitle(course)} · ${detail?.kind === "exam" ? "Exams" : "Study sets"}` : "Courses"}
        </button>

        {/* Hero */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden card p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-brand/20 to-brand-2/20 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="chip bg-brand-soft text-brand">
                  {detail?.kind === "exam" ? <ClipboardCheck className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
                  {detail?.kind === "exam" ? "Exam" : "Study set"}
                </span>
                <StatusChip status={detail?.status ?? null} queueNumber={detail?.queueNumber ?? null} count={quiz?.questions.length ?? 0} />
                {quiz && quiz.terms.length > 0 && <span className="chip bg-surface-2 text-muted">{quiz.terms.length} key terms</span>}
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight truncate">{detail?.name ?? "…"}</h1>
              <p className="mt-2 text-muted">
                {detail?.kind === "exam"
                  ? `Combines ${sourceCount} study set${sourceCount === 1 ? "" : "s"}, rebuilt whenever they change.`
                  : folder
                  ? `Made from the ${folder.file_count} file${folder.file_count === 1 ? "" : "s"} in “${folder.name}”, updated whenever they change.`
                  : detail?.description || ""}
              </p>
            </div>
            {detail?.lastScore != null && (
              <div className="flex flex-col items-center">
                <ScoreRing percent={Number(detail.lastScore)} size={110} stroke={10} />
                <span className="mt-1 text-xs font-semibold text-muted">Last score</span>
              </div>
            )}
          </div>
          {generating && (
            <div className="relative mt-6">
              <p className="text-sm font-semibold mb-3">
                {hasQuestions ? "Updating with the latest files…" : "The AI is building this set…"}
              </p>
              <GenerationProgress progress={detail?.progress} status={detail?.status} queueNumber={detail?.queueNumber} />
            </div>
          )}
        </motion.section>

        {/* Modes */}
        <h2 className="mt-10 mb-4 text-xl font-bold">Study</h2>
        {!hasQuestions && !generating && detail?.status === "failed" && (
          <div className="card p-5 mb-4 flex items-center gap-3 border-red-500/40">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="flex-1 text-sm">Generating failed. Check the files are readable documents and try again.</p>
            <button onClick={regenerateNow} className="btn-primary" disabled={busy}>
              Try again
            </button>
          </div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {modes.map((m, i) => {
            const blocked = quiz ? (hasQuestions ? m.unavailable(quiz) : generating ? "Generating…" : "Not generated yet") : "Loading";
            return (
              <motion.button
                key={m.mode}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035 }}
                disabled={!!blocked}
                onClick={() => quizId && router.push(studyHref(quizId, m.mode))}
                className={`group card text-left p-5 flex flex-col gap-3 transition ${blocked ? "opacity-55 cursor-not-allowed" : "card-hover"}`}
              >
                <span
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${m.gradient} text-white flex items-center justify-center shadow-md transition ${
                    blocked ? "grayscale" : "group-hover:scale-110 group-hover:-rotate-3"
                  }`}
                >
                  <m.icon className="w-6 h-6" />
                </span>
                <div>
                  <p className="font-bold">{m.title}</p>
                  <p className="text-sm text-muted mt-0.5">{m.blurb}</p>
                </div>
                {blocked && (
                  <span className="mt-auto chip bg-surface-2 text-muted">
                    <Lock className="w-3 h-3" /> {blocked}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Source and settings */}
        <div className="mt-10 grid lg:grid-cols-[1fr_20rem] gap-6 items-start">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{detail?.kind === "exam" ? "Study sets it covers" : "Files"}</h2>
              {course && (
                <Link href={courseHref(course.id, detail?.kind === "exam" ? "" : "files")} className="text-sm font-semibold text-brand hover:underline">
                  {detail?.kind === "exam" ? "All study sets" : "Manage files"}
                </Link>
              )}
            </div>
            {detail?.kind === "exam" ? (
              <ul className="flex flex-col gap-2">
                {sources.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
                    <Folder className="w-4 h-4 text-brand" />
                    <span className="flex-1 font-medium truncate">{s.name}</span>
                    <span className="text-xs text-muted">{s.questions.length} questions</span>
                  </li>
                ))}
                {sources.length === 0 && <p className="text-sm text-muted">The study sets it was made from are gone; it keeps the questions it has.</p>}
              </ul>
            ) : files.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
                    <FileText className="w-4 h-4 text-brand" />
                    <span className="flex-1 font-medium truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{folder ? "This folder is empty." : "This set was made before folders; it keeps the files it was made from."}</p>
            )}
          </div>

          <div className="card p-6 lg:sticky lg:top-24">
            <h2 className="font-bold text-lg">Kept up to date</h2>
            <p className="text-sm text-muted mt-1">
              {detail?.kind === "exam"
                ? "It's rebuilt whenever a study set it covers changes. The AI decides how many questions it needs to cover them fully."
                : "It's rebuilt whenever the folder's files change. The AI writes as many questions as the material needs, and each session draws a different mix."}
            </p>
            <button onClick={regenerateNow} disabled={generating || busy} className="btn-secondary w-full mt-5">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Regenerate now
            </button>
            {detail?.kind === "exam" && (
              <button onClick={() => setConfirmDelete(true)} className="btn-ghost w-full mt-2 text-red-500 hover:text-red-500 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4" /> Delete exam
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <AlertPopup
          message={`Delete the exam “${detail?.name}”?`}
          onClose={() => setConfirmDelete(false)}
          actions={[
            { label: "Cancel", color: "gray", onClick: () => setConfirmDelete(false) },
            {
              label: "Delete",
              color: "red",
              onClick: async () => {
                setConfirmDelete(false);
                if (quizId) await deleteQuizzes([quizId]).catch(() => {});
                router.push(back);
              },
            },
          ]}
        />
      )}
    </div>
  );
}

function StatusChip({ status, queueNumber, count }: { status: GenerationStatus; queueNumber: number | null; count: number }) {
  if (status === "queued" || status === "pending")
    return (
      <span className="chip bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        {status === "queued" ? `Queued${queueNumber ? ` #${queueNumber}` : ""}` : "Generating"}
      </span>
    );
  if (status === "failed")
    return (
      <span className="chip bg-red-500/15 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-3 h-3" /> Generation failed
      </span>
    );
  if (count > 0)
    return (
      <span className="chip bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Check className="w-3 h-3" /> {count} questions
      </span>
    );
  return (
    <span className="chip bg-surface-2 text-muted">
      <Wand2 className="w-3 h-3" /> Not generated yet
    </span>
  );
}
