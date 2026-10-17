"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  FileText,
  FolderInput,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import QuizCard from "@/components/QuizCard";
import CreateQuizPopup from "@/components/CreateQuizPopup";
import FileUploadPopup from "@/components/FileUploadPopup";
import QuizAddFilePopup from "@/components/QuizAddFilePopup";
import AlertPopup from "@/components/AlertPopup";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import ScoreRing from "@/components/ui/ScoreRing";
import { AutopilotModal } from "@/components/courses/CourseModals";
import {
  attachFiles,
  colorOf,
  courseColors,
  courseFiles,
  courseQuizzes,
  createQuiz,
  deleteCourse,
  deleteFiles,
  formatBytes,
  getCourse,
  updateCourse,
  uploadFile,
  uploadYouTube,
  type Course,
  type CourseFile,
  type QuizSummary,
} from "@/lib/courses";

type Tab = "overview" | "sets" | "files";

const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "sets", label: "Study sets", icon: BookOpen },
  { key: "files", label: "Files", icon: FileText },
];

/** /courses/{id}: one course, with tabs for its overview, its study sets and its files. */
export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const id = Number(courseId);
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [files, setFiles] = useState<CourseFile[] | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [alert, setAlert] = useState<string | null>(null);

  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const [newSetOpen, setNewSetOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, q, f] = await Promise.all([getCourse(id), courseQuizzes(id), courseFiles(id)]);
      setCourse(c);
      setQuizzes(q);
      setFiles(f);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // While sets are generating, keep their status fresh.
  const generating = (quizzes ?? []).some((q) => q.generation_status === "queued" || q.generation_status === "pending");
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [generating, load]);

  const openQuiz = (q: { id: number; name: string }) => {
    sessionStorage.setItem("selectedQuizId", String(q.id));
    router.push(`/quizDetails/${encodeURIComponent(q.name)}`);
  };

  if (error)
    return (
      <div className="page flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-bold">{error}</p>
        <button className="btn-primary" onClick={() => router.push("/courses")}>
          Back to courses
        </button>
      </div>
    );

  if (!course)
    return (
      <div className="page mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="skeleton h-48 rounded-3xl" />
      </div>
    );

  const color = colorOf(course);
  const ready = (quizzes ?? []).filter((q) => q.generation_status === "success");
  const scored = ready.filter((q) => q.last_score != null);
  const average = scored.length ? scored.reduce((s, q) => s + Number(q.last_score), 0) / scored.length : null;

  return (
    <div className="page">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <button onClick={() => router.push("/courses")} className="btn-ghost -ml-3 mb-4 px-3 py-1.5 text-sm">
          <ChevronLeft className="w-4 h-4" /> Courses
        </button>

        {/* Banner */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${color.gradient} p-6 sm:p-8 text-white shadow-xl`}
        >
          <div className="animate-drift absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-sm" />
          <div className="absolute right-24 -bottom-20 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {course.code && <span className="chip bg-white/20 backdrop-blur text-white">{course.code}</span>}
                {course.term && <span className="chip bg-white/20 backdrop-blur text-white">{course.term}</span>}
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{course.name}</h1>
              <p className="mt-2 text-white/80">
                {course.quiz_count} study set{course.quiz_count === 1 ? "" : "s"} · {course.file_count} file{course.file_count === 1 ? "" : "s"}
                {course.generating_count > 0 && ` · ${course.generating_count} generating`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAutopilotOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-bold text-slate-900 shadow-lg transition hover:scale-105 active:scale-95"
              >
                <Rocket className="w-4 h-4" /> Autopilot
              </button>
              <button onClick={() => setEditOpen(true)} className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition" title="Edit course">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Tabs */}
        <div className="mt-8 mb-6 flex gap-1 border-b border-stroke">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition ${
                tab === t.key ? "text-brand" : "text-muted hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.key === "sets" && quizzes && <span className="chip bg-surface-2 text-muted px-2 py-0.5">{quizzes.length}</span>}
              {t.key === "files" && files && <span className="chip bg-surface-2 text-muted px-2 py-0.5">{files.length}</span>}
              {tab === t.key && (
                <motion.span layoutId="course-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-brand to-brand-2 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {tab === "overview" && (
              <div className="grid lg:grid-cols-[1fr_20rem] gap-6 items-start">
                <div className="flex flex-col gap-6">
                  {/* Autopilot pitch */}
                  <div className="card relative overflow-hidden p-6 sm:p-8">
                    <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-gradient-to-br from-brand/20 to-brand-2/20 blur-2xl" />
                    <div className="relative flex flex-col sm:flex-row gap-5 sm:items-center">
                      <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white flex items-center justify-center shadow-lg animate-float">
                        <Sparkles className="w-7 h-7" />
                      </span>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold">Let the AI build this course for you</h2>
                        <p className="text-muted mt-1">
                          {course.file_count
                            ? "Autopilot reads your files, splits them into topics and makes a study set for each, plus a final review."
                            : "Upload your lecture notes, then let Autopilot turn them into study sets, one per topic, plus a final review."}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {!course.file_count && (
                          <button onClick={() => setUploadOpen(true)} className="btn-secondary">
                            <UploadCloud className="w-4 h-4" /> Upload files
                          </button>
                        )}
                        <button onClick={() => setAutopilotOpen(true)} className="btn-primary">
                          <Rocket className="w-4 h-4" /> Run autopilot
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recent sets */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-bold text-lg">Study sets</h2>
                      {quizzes && quizzes.length > 0 && (
                        <button onClick={() => setTab("sets")} className="text-sm font-semibold text-brand hover:underline">
                          See all
                        </button>
                      )}
                    </div>
                    {quizzes && quizzes.length === 0 ? (
                      <button
                        onClick={() => setNewSetOpen(true)}
                        className="w-full rounded-2xl border-2 border-dashed border-stroke py-10 text-muted hover:border-brand/50 hover:text-brand transition flex flex-col items-center gap-2"
                      >
                        <Plus className="w-7 h-7" />
                        <span className="font-semibold">Make a study set yourself</span>
                      </button>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(quizzes ?? []).slice(0, 4).map((q) => (
                          <QuizCard
                            key={q.id}
                            quizName={q.name}
                            description={q.description}
                            lastScore={q.last_score}
                            status={q.generation_status}
                            questionCount={q.questions.length}
                            selected={false}
                            onClick={() => openQuiz(q)}
                            onDoubleClick={() => {}}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="card p-6 flex flex-col items-center text-center lg:sticky lg:top-24">
                  <h2 className="font-bold text-lg self-start">Progress</h2>
                  <div className="my-4">
                    {average != null ? (
                      <ScoreRing percent={average} size={140} label="average" />
                    ) : (
                      <div className="w-[140px] h-[140px] rounded-full border-[12px] border-surface-2 flex items-center justify-center text-sm text-muted">
                        No scores yet
                      </div>
                    )}
                  </div>
                  <div className="w-full grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Ready", value: ready.length },
                      { label: "Studied", value: scored.length },
                      { label: "Files", value: files?.length ?? 0 },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl bg-surface-2 p-2.5">
                        <p className="text-xl font-extrabold tabular-nums">{s.value}</p>
                        <p className="text-xs text-muted">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "sets" && (
              <>
                <div className="flex flex-wrap gap-2 mb-5">
                  <button onClick={() => setNewSetOpen(true)} className="btn-primary">
                    <Plus className="w-4 h-4" /> New study set
                  </button>
                  <button onClick={() => setAutopilotOpen(true)} className="btn-secondary">
                    <Rocket className="w-4 h-4" /> Autopilot
                  </button>
                </div>
                {quizzes && quizzes.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="No study sets yet"
                    text="Make one yourself, or run Autopilot to have the AI build the whole course from your files."
                    action="New study set"
                    onAction={() => setNewSetOpen(true)}
                  />
                ) : (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {(quizzes ?? []).map((q, i) => (
                      <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
                        <QuizCard
                          quizName={q.name}
                          description={q.description}
                          lastScore={q.last_score}
                          status={q.generation_status}
                          questionCount={q.questions.length}
                          selected={false}
                          onClick={() => openQuiz(q)}
                          onDoubleClick={() => {}}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "files" && (
              <FilesTab
                files={files ?? []}
                onUpload={() => setUploadOpen(true)}
                onLibrary={() => setLibraryOpen(true)}
                onDelete={async (fileIds) => {
                  await deleteFiles(fileIds).catch((e) => setAlert(e.message));
                  load();
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AutopilotModal
        isOpen={autopilotOpen}
        onClose={() => setAutopilotOpen(false)}
        course={course}
        onDone={() => {
          load();
          setTab("sets");
        }}
      />

      <CreateQuizPopup
        isOpen={newSetOpen}
        onClose={() => setNewSetOpen(false)}
        onCreateQuiz={async (name, description) => {
          const { quizId } = await createQuiz(name, description ?? "", id);
          openQuiz({ id: quizId, name });
        }}
      />

      {uploadOpen && (
        <FileUploadPopup
          isOpen
          onClose={() => {
            setUploadOpen(false);
            load();
          }}
          onFileUpload={(file, onProgress) => uploadFile(file, { courseId: id }, onProgress)}
          onYouTubeUpload={(url, onProgress) => uploadYouTube(url, id, onProgress)}
        />
      )}

      <QuizAddFilePopup
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        existingFileIds={(files ?? []).map((f) => f.id)}
        onAddFiles={async (picked: { id: number }[]) => {
          await attachFiles(id, picked.map((f) => f.id)).catch((e) => setAlert(e.message));
          load();
        }}
      />

      <EditCourseModal
        isOpen={editOpen}
        course={course}
        onClose={() => setEditOpen(false)}
        onSaved={setCourse}
        onDeleted={() => router.push("/courses")}
      />

      {alert && <AlertPopup message={alert} onClose={() => setAlert(null)} />}
    </div>
  );
}

function FilesTab({
  files,
  onUpload,
  onLibrary,
  onDelete,
}: {
  files: CourseFile[];
  onUpload: () => void;
  onLibrary: () => void;
  onDelete: (ids: number[]) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<CourseFile | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={onUpload} className="btn-primary">
          <UploadCloud className="w-4 h-4" /> Upload
        </button>
        <button onClick={onLibrary} className="btn-secondary">
          <FolderInput className="w-4 h-4" /> Add from my files
        </button>
      </div>
      {files.length === 0 ? (
        <EmptyState
          icon={UploadCloud}
          title="No files in this course"
          text="Upload lecture slides, notes, readings or YouTube lectures. Study sets and Autopilot are built from them."
          action="Upload files"
          onAction={onUpload}
        />
      ) : (
        <div className="card divide-y divide-stroke overflow-hidden">
          <AnimatePresence initial={false}>
            {files.map((f, i) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: Math.min(i, 15) * 0.02 }}
                className="group flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2/60 transition"
              >
                <span className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-extrabold">
                  {f.name.includes(".") ? f.name.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{f.name}</p>
                  <p className="text-xs text-muted">
                    {formatBytes(f.size)} · added {new Date(f.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setConfirm(f)}
                  className="icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 hover:bg-red-500/10"
                  title="Delete file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {confirm && (
        <AlertPopup
          message={`Delete “${confirm.name}”? Study sets made from it keep their questions.`}
          onClose={() => setConfirm(null)}
          actions={[
            { label: "Cancel", color: "gray", onClick: () => setConfirm(null) },
            {
              label: "Delete",
              color: "red",
              onClick: async () => {
                const f = confirm;
                setConfirm(null);
                await onDelete([f.id]);
              },
            },
          ]}
        />
      )}
    </>
  );
}

function EditCourseModal({
  isOpen,
  course,
  onClose,
  onSaved,
  onDeleted,
}: {
  isOpen: boolean;
  course: Course;
  onClose: () => void;
  onSaved: (c: Course) => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState({ code: course.code, name: course.name, term: course.term, color: course.color });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) setDraft({ code: course.code, name: course.name, term: course.term, color: course.color });
  }, [isOpen, course]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(await updateCourse(course.id, draft));
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} locked={busy} title="Edit course" icon={<Pencil className="w-5 h-5" />}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <div>
            <label className="label">Code</label>
            <input className="input" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Term</label>
          <input className="input" value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })} />
        </div>
        <div>
          <label className="label">Colour</label>
          <div className="flex gap-2">
            {Object.entries(courseColors).map(([key, c]) => (
              <button
                type="button"
                key={key}
                onClick={() => setDraft({ ...draft, color: key })}
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${c.gradient} transition ${
                  draft.color === key ? "ring-2 ring-offset-2 ring-offset-surface ring-brand scale-110" : "hover:scale-110"
                }`}
                aria-label={key}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy || !draft.name.trim()}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
        </button>
        <button type="button" onClick={() => setConfirmDelete(true)} className="btn-ghost text-red-500 hover:text-red-500 hover:bg-red-500/10">
          <Trash2 className="w-4 h-4" /> Delete course
        </button>
      </form>
      {confirmDelete && (
        <AlertPopup
          message={`Delete ${course.code || course.name}, with all its study sets and files? This can't be undone.`}
          onClose={() => setConfirmDelete(false)}
          actions={[
            { label: "Cancel", color: "gray", onClick: () => setConfirmDelete(false) },
            {
              label: "Delete",
              color: "red",
              onClick: async () => {
                setConfirmDelete(false);
                await deleteCourse(course.id);
                onDeleted();
              },
            },
          ]}
        />
      )}
    </Modal>
  );
}
