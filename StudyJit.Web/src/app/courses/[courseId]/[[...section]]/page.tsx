"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Check,
  ClipboardCheck,
  Folder,
  FolderOpen,
  FolderPlus,
  Inbox,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react";
import QuizCard from "@/components/QuizCard";
import FileUploadPopup from "@/components/FileUploadPopup";
import AlertPopup from "@/components/AlertPopup";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import {
  applyFolders,
  colorOf,
  courseColors,
  courseFiles,
  courseHref,
  courseQuizzes,
  createExam,
  createFolder,
  deleteCourse,
  deleteFiles,
  deleteFolder,
  formatBytes,
  getCourse,
  listFolders,
  moveFiles,
  organizeFiles,
  renameFolder,
  updateCourse,
  uploadFile,
  uploadYouTube,
  type Course,
  type CourseFile,
  type CourseFolder,
  type CourseSection,
  type FolderPlan,
  type QuizSummary,
} from "@/lib/courses";

/** Sorts "Week 2" before "Week 10". */
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

/** /courses/{id}/{section}: one course. The navbar shows its sections (Study sets, Exams, Files) as tabs. */
export default function CoursePage() {
  const params = useParams<{ courseId: string; section?: string[] }>();
  const id = Number(params.courseId);
  const section = (params.section?.[0] ?? "") as CourseSection;
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [files, setFiles] = useState<CourseFile[] | null>(null);
  const [folders, setFolders] = useState<CourseFolder[] | null>(null);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, q, f, d] = await Promise.all([getCourse(id), courseQuizzes(id), courseFiles(id), listFolders(id)]);
      setCourse(c);
      setQuizzes(q);
      setFiles(f);
      setFolders([...d].sort(byName));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Sets regenerate on their own when files change: keep their status fresh while any are working.
  const generating = (quizzes ?? []).some((q) => q.generation_status === "queued" || q.generation_status === "pending");
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [generating, load]);

  const openQuiz = (q: QuizSummary) => {
    sessionStorage.setItem("selectedQuizId", String(q.id));
    sessionStorage.setItem("currentCourseId", String(id));
    sessionStorage.setItem("currentCourseSection", q.kind === "exam" ? "exams" : "");
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
        <div className="skeleton h-28 rounded-3xl" />
      </div>
    );

  const sets = (quizzes ?? []).filter((q) => q.kind !== "exam");
  const exams = (quizzes ?? []).filter((q) => q.kind === "exam");

  return (
    <div className="page">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Banner */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`print:hidden relative overflow-hidden rounded-3xl bg-gradient-to-br ${colorOf(course).gradient} px-6 py-6 text-white shadow-xl`}
        >
          <div className="animate-drift absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-sm" />
          <div className="absolute right-24 -bottom-20 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {course.code && <span className="chip bg-white/20 backdrop-blur text-white">{course.code}</span>}
                {course.term && <span className="chip bg-white/20 backdrop-blur text-white">{course.term}</span>}
                {generating && (
                  <span className="chip bg-white/20 backdrop-blur text-white">
                    <Loader2 className="w-3 h-3 animate-spin" /> Updating study sets
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{course.name}</h1>
            </div>
            <button onClick={() => setEditOpen(true)} className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition" title="Edit course">
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        </motion.section>

        <AnimatePresence mode="wait">
          <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="mt-8">
            {section === "" && <SetsSection course={course} sets={sets} folders={folders ?? []} files={files ?? []} onOpen={openQuiz} />}
            {section === "exams" && <ExamsSection course={course} sets={sets} exams={exams} onOpen={openQuiz} onCreated={load} />}
            {section === "files" && <FilesSection course={course} files={files ?? []} folders={folders ?? []} sets={sets} reload={load} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <EditCourseModal isOpen={editOpen} course={course} onClose={() => setEditOpen(false)} onSaved={setCourse} onDeleted={() => router.push("/courses")} />
    </div>
  );
}

/* ------------------------------ Study sets ------------------------------ */

function SetsSection({
  course,
  sets,
  folders,
  files,
  onOpen,
}: {
  course: Course;
  sets: QuizSummary[];
  folders: CourseFolder[];
  files: CourseFile[];
  onOpen: (q: QuizSummary) => void;
}) {
  const folderName = (id: number | null) => folders.find((f) => f.id === id)?.name;
  // In folder order, so the weeks read in sequence; sets from before folders come last.
  const ordered = [...sets].sort((a, b) => {
    const fa = folders.findIndex((f) => f.id === a.folder_id);
    const fb = folders.findIndex((f) => f.id === b.folder_id);
    return (fa < 0 ? 1e6 : fa) - (fb < 0 ? 1e6 : fb) || byName(a, b);
  });
  const unsorted = files.filter((f) => f.folder_id == null || !folders.some((d) => d.id === f.folder_id)).length;

  return (
    <>
      <SectionHead
        title="Study sets"
        text="One for each folder of files, made and kept up to date automatically: quizzes, flashcards, games, a study guide and a cheat sheet."
      />
      {unsorted > 0 && (
        <Link
          href={courseHref(course.id, "files")}
          className="mb-6 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-5 py-4 text-sm hover:brightness-95 transition"
        >
          <Inbox className="w-5 h-5 text-brand flex-shrink-0" />
          <span className="flex-1">
            <b>{unsorted} file{unsorted === 1 ? " isn't" : "s aren't"} in a folder yet,</b> so {unsorted === 1 ? "it isn't" : "they aren't"} in any study set.
          </span>
          <span className="font-semibold text-brand">Sort them →</span>
        </Link>
      )}
      {sets.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Study sets appear here on their own"
          text="Put your files into folders (one per week, chapter or topic) in the Files tab. Each folder becomes a study set, generated automatically."
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {ordered.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <QuizCard
                quizName={q.name}
                description={
                  folderName(q.folder_id)
                    ? `${folders.find((f) => f.id === q.folder_id)!.file_count} file${folders.find((f) => f.id === q.folder_id)!.file_count === 1 ? "" : "s"} in ${folderName(q.folder_id)}`
                    : q.description
                }
                lastScore={q.last_score}
                status={q.generation_status}
                questionCount={q.questions.length}
                selected={false}
                onClick={() => onOpen(q)}
                onDoubleClick={() => {}}
              />
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------ Exams ------------------------------ */

function ExamsSection({
  course,
  sets,
  exams,
  onOpen,
  onCreated,
}: {
  course: Course;
  sets: QuizSummary[];
  exams: QuizSummary[];
  onOpen: (q: QuizSummary) => void;
  onCreated: () => void;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <SectionHead title="Exams" text="Practice exams that combine the study sets you choose, like everything a midterm covers.">
        <button onClick={() => setCreating(true)} className="btn-primary" disabled={sets.length === 0}>
          <Plus className="w-4 h-4" /> New exam
        </button>
      </SectionHead>
      {exams.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={sets.length ? "No exams yet" : "Make study sets first"}
          text={
            sets.length
              ? "Pick the study sets your midterm or final covers and the AI writes a full practice exam from them."
              : "Exams are built from study sets. Put your files into folders in the Files tab and the sets will follow."
          }
          action={sets.length ? "New exam" : undefined}
          onAction={sets.length ? () => setCreating(true) : undefined}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <QuizCard
                quizName={q.name}
                description={q.description}
                lastScore={q.last_score}
                status={q.generation_status}
                questionCount={q.questions.length}
                selected={false}
                onClick={() => onOpen(q)}
                onDoubleClick={() => {}}
              />
            </motion.div>
          ))}
        </div>
      )}
      <NewExamModal
        isOpen={creating}
        course={course}
        sets={sets}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          onCreated();
        }}
      />
    </>
  );
}

function NewExamModal({
  isOpen,
  course,
  sets,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  course: Course;
  sets: QuizSummary[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("Midterm");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [questions, setQuestions] = useState(30);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPicked(new Set(sets.map((s) => s.id)));
      setError("");
    }
  }, [isOpen, sets]);

  const toggle = (id: number) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      await createExam(course.id, { name: name.trim(), set_ids: [...picked], questions, focus });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} locked={busy} title="New exam" icon={<ClipboardCheck className="w-5 h-5" />} width="max-w-xl">
      <div className="flex flex-col gap-5">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            {["Midterm", "Final", "Quiz 1", "Unit test"].map((n) => (
              <button
                key={n}
                onClick={() => setName(n)}
                className={`chip transition ${name === n ? "bg-brand text-white" : "bg-surface-2 text-muted hover:text-foreground"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Covers</label>
            <button
              className="text-sm font-semibold text-brand hover:underline"
              onClick={() => setPicked(picked.size === sets.length ? new Set() : new Set(sets.map((s) => s.id)))}
            >
              {picked.size === sets.length ? "Select none" : "Select all"}
            </button>
          </div>
          <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
            {sets.map((s) => {
              const on = picked.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    onClick={() => toggle(s.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${on ? "border-brand bg-brand-soft" : "border-stroke hover:bg-surface-2"}`}
                  >
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${on ? "bg-brand border-brand text-white" : "border-stroke"}`}>
                      {on && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="flex-1 font-medium truncate">{s.name}</span>
                    {s.generation_status !== "success" && <span className="text-xs text-muted">generating</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <label className="label">Questions</label>
          <div className="flex items-center gap-4">
            <input type="range" min={5} max={50} value={questions} onChange={(e) => setQuestions(Number(e.target.value))} className="flex-1 accent-[var(--brand)]" />
            <span className="w-10 text-center text-2xl font-extrabold text-brand tabular-nums">{questions}</span>
          </div>
        </div>

        <div>
          <label className="label">Focus (optional)</label>
          <input className="input" placeholder="e.g. Harder questions, include calculations" value={focus} onChange={(e) => setFocus(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={create} className="btn-primary py-3" disabled={busy || !name.trim() || picked.size === 0}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
          Create exam from {picked.size} study set{picked.size === 1 ? "" : "s"}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------ Files ------------------------------ */

const ALL = -1;
const UNSORTED = 0;

function FilesSection({
  course,
  files,
  folders,
  sets,
  reload,
}: {
  course: Course;
  files: CourseFile[];
  folders: CourseFolder[];
  sets: QuizSummary[];
  reload: () => Promise<void>;
}) {
  const [view, setView] = useState<number>(ALL);
  const [uploading, setUploading] = useState(false);
  const [newFolder, setNewFolder] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [renaming, setRenaming] = useState<CourseFolder | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; run: () => Promise<unknown> } | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  const inFolder = (f: CourseFile) => f.folder_id != null && folders.some((d) => d.id === f.folder_id);
  const unsorted = files.filter((f) => !inFolder(f));
  const shown = (view === ALL ? files : view === UNSORTED ? unsorted : files.filter((f) => f.folder_id === view)).slice().sort(byName);
  const current = folders.find((f) => f.id === view);
  const setFor = (folderId: number) => sets.find((s) => s.folder_id === folderId);

  // A view that no longer exists (folder deleted) falls back to all files.
  useEffect(() => {
    if (view > 0 && !folders.some((f) => f.id === view)) setView(ALL);
  }, [folders, view]);

  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (e) {
      setAlert((e as Error).message);
    }
    await reload();
  };

  return (
    <>
      <SectionHead title="Files" text="Each folder becomes a study set. Adding, moving or removing files updates the folder's study set automatically.">
        <button onClick={() => setUploading(true)} className="btn-primary">
          <UploadCloud className="w-4 h-4" /> Upload{current ? ` to ${current.name}` : ""}
        </button>
        <button onClick={() => setNewFolder(true)} className="btn-secondary">
          <FolderPlus className="w-4 h-4" /> New folder
        </button>
        <button onClick={() => setOrganizing(true)} className="btn-secondary" disabled={files.length === 0}>
          <Sparkles className="w-4 h-4" /> Organize with AI
        </button>
      </SectionHead>

      {files.length === 0 && folders.length === 0 ? (
        <EmptyState
          icon={UploadCloud}
          title="No files in this course"
          text="Upload lecture slides, notes, readings or YouTube lectures, then sort them into folders (one per week or topic). Each folder becomes a study set."
          action="Upload files"
          onAction={() => setUploading(true)}
        />
      ) : (
        <div className="grid md:grid-cols-[16rem_1fr] gap-6 items-start">
          {/* Folders */}
          <nav className="card p-2 flex flex-col gap-0.5 md:sticky md:top-24">
            <FolderButton icon={<FolderOpen className="w-4 h-4" />} name="All files" count={files.length} active={view === ALL} onClick={() => setView(ALL)} />
            {folders.map((f) => {
              const set = setFor(f.id);
              return (
                <FolderButton
                  key={f.id}
                  icon={<Folder className="w-4 h-4" />}
                  name={f.name}
                  count={f.file_count}
                  active={view === f.id}
                  onClick={() => setView(f.id)}
                  status={set ? (set.generation_status === "success" ? "ready" : set.generation_status === "failed" ? "failed" : "working") : undefined}
                />
              );
            })}
            {unsorted.length > 0 && (
              <FolderButton icon={<Inbox className="w-4 h-4" />} name="Not in a folder" count={unsorted.length} active={view === UNSORTED} onClick={() => setView(UNSORTED)} muted />
            )}
          </nav>

          {/* Files */}
          <div className="flex flex-col gap-4">
            {current && (
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold flex-1 min-w-0 truncate">{current.name}</h3>
                <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setRenaming(current)}>
                  <Pencil className="w-4 h-4" /> Rename
                </button>
                <button
                  className="btn-ghost px-3 py-1.5 text-sm hover:text-red-500 hover:bg-red-500/10"
                  onClick={() =>
                    setConfirm({
                      message: `Delete the folder “${current.name}” and its study set? Its files stay in the course.`,
                      run: () => deleteFolder(course.id, current.id),
                    })
                  }
                >
                  <Trash2 className="w-4 h-4" /> Delete folder
                </button>
              </div>
            )}
            {view === UNSORTED && unsorted.length > 0 && (
              <p className="rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                Files outside folders aren&apos;t in any study set. Move them into a folder, or let the AI sort them.
              </p>
            )}
            {shown.length === 0 ? (
              <div className="card border-dashed p-10 text-center text-muted">
                {current ? (
                  <>
                    This folder is empty.{" "}
                    <button className="font-semibold text-brand hover:underline" onClick={() => setUploading(true)}>
                      Upload files into it
                    </button>{" "}
                    or move some here.
                  </>
                ) : (
                  "No files here."
                )}
              </div>
            ) : (
              <div className="card divide-y divide-stroke">
                <AnimatePresence initial={false}>
                  {shown.map((f, i) => (
                    <FileRow
                      key={f.id}
                      file={f}
                      index={i}
                      folders={folders}
                      showFolder={view === ALL}
                      onMove={(folderId) => act(() => moveFiles(course.id, [f.id], folderId))}
                      onDelete={() => setConfirm({ message: `Delete “${f.name}”?`, run: () => deleteFiles([f.id]) })}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}

      {uploading && (
        <FileUploadPopup
          isOpen
          onClose={() => {
            setUploading(false);
            reload();
          }}
          onFileUpload={(file, onProgress) => uploadFile(file, { courseId: course.id, folderId: current ? String(current.id) : null }, onProgress)}
          onYouTubeUpload={(url, onProgress) => uploadYouTube(url, { courseId: course.id, folderId: current ? String(current.id) : null }, onProgress)}
        />
      )}

      <NameModal
        isOpen={newFolder}
        title="New folder"
        placeholder="e.g. Week 1"
        action="Create folder"
        onClose={() => setNewFolder(false)}
        onSubmit={async (name) => {
          const folder = await createFolder(course.id, name);
          await reload();
          setView(folder.id);
        }}
      />
      <NameModal
        isOpen={!!renaming}
        title="Rename folder"
        initial={renaming?.name}
        action="Rename"
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          await renameFolder(course.id, renaming!.id, name);
          await reload();
        }}
      />
      <OrganizeModal
        isOpen={organizing}
        course={course}
        files={files}
        onClose={() => setOrganizing(false)}
        onApplied={async () => {
          setOrganizing(false);
          await reload();
        }}
      />

      {confirm && (
        <AlertPopup
          message={confirm.message}
          onClose={() => setConfirm(null)}
          actions={[
            { label: "Cancel", color: "gray", onClick: () => setConfirm(null) },
            {
              label: "Delete",
              color: "red",
              onClick: () => {
                const run = confirm.run;
                setConfirm(null);
                act(run);
              },
            },
          ]}
        />
      )}
      {alert && <AlertPopup message={alert} onClose={() => setAlert(null)} />}
    </>
  );
}

function FolderButton({
  icon,
  name,
  count,
  active,
  onClick,
  status,
  muted,
}: {
  icon: React.ReactNode;
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
  status?: "ready" | "working" | "failed";
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-left transition ${
        active ? "text-brand" : muted ? "text-muted hover:bg-surface-2" : "hover:bg-surface-2"
      }`}
    >
      {active && <motion.span layoutId="folder-active" className="absolute inset-0 rounded-xl bg-brand-soft" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
      <span className="relative">{icon}</span>
      <span className="relative flex-1 truncate">{name}</span>
      {status === "working" && <Loader2 className="relative w-3.5 h-3.5 animate-spin text-amber-500" />}
      {status === "ready" && <BookOpen className="relative w-3.5 h-3.5 text-emerald-500" />}
      {status === "failed" && <span className="relative w-2 h-2 rounded-full bg-red-500" />}
      <span className="relative text-xs text-muted tabular-nums">{count}</span>
    </button>
  );
}

function FileRow({
  file,
  index,
  folders,
  showFolder,
  onMove,
  onDelete,
}: {
  file: CourseFile;
  index: number;
  folders: CourseFolder[];
  showFolder: boolean;
  onMove: (folderId: number | null) => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const folder = folders.find((f) => f.id === file.folder_id);
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ delay: Math.min(index, 15) * 0.02 }}
      className="group relative flex items-center gap-4 px-5 py-3 hover:bg-surface-2/60 transition first:rounded-t-2xl last:rounded-b-2xl"
    >
      <span className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
        {file.name.includes(".") ? file.name.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE"}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{file.name}</p>
        <p className="text-xs text-muted">
          {formatBytes(file.size)}
          {showFolder && (folder ? ` · ${folder.name}` : " · not in a folder")}
        </p>
      </div>
      <button onClick={() => setMenu(!menu)} className="icon-btn" title="Move or delete">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      <AnimatePresence>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ transformOrigin: "top right" }}
              className="absolute right-4 top-12 z-20 w-56 card p-1.5 max-h-72 overflow-y-auto"
            >
              <p className="px-3 pt-1 pb-1.5 text-xs font-bold uppercase tracking-wider text-muted">Move to</p>
              {folders.map((f) => (
                <button
                  key={f.id}
                  disabled={f.id === file.folder_id}
                  onClick={() => {
                    setMenu(false);
                    onMove(f.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left hover:bg-surface-2 disabled:opacity-40"
                >
                  <Folder className="w-4 h-4 text-muted" /> <span className="truncate">{f.name}</span>
                </button>
              ))}
              {file.folder_id != null && (
                <button
                  onClick={() => {
                    setMenu(false);
                    onMove(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left text-muted hover:bg-surface-2"
                >
                  <Inbox className="w-4 h-4" /> Out of folders
                </button>
              )}
              <hr className="border-stroke my-1.5" />
              <button
                onClick={() => {
                  setMenu(false);
                  onDelete();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" /> Delete file
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** The AI proposes folders for the course's files; you can rename them or drop any before they're made. */
function OrganizeModal({
  isOpen,
  course,
  files,
  onClose,
  onApplied,
}: {
  isOpen: boolean;
  course: Course;
  files: CourseFile[];
  onClose: () => void;
  onApplied: () => Promise<void>;
}) {
  const [plan, setPlan] = useState<FolderPlan[] | null>(null);
  const [busy, setBusy] = useState<"thinking" | "applying" | null>(null);
  const [error, setError] = useState("");
  const names = useMemo(() => new Map(files.map((f) => [f.id, f.name])), [files]);

  useEffect(() => {
    if (!isOpen) return;
    setPlan(null);
    setError("");
    setBusy("thinking");
    organizeFiles(course.id)
      .then(setPlan, (e) => setError((e as Error).message))
      .finally(() => setBusy(null));
  }, [isOpen, course.id]);

  const apply = async () => {
    if (!plan) return;
    setBusy("applying");
    try {
      await applyFolders(course.id, plan);
      await onApplied();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} locked={busy === "applying"} title="Organize with AI" icon={<Sparkles className="w-5 h-5" />} width="max-w-2xl">
      {busy === "thinking" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          Sorting {files.length} files into folders…
        </div>
      ) : plan ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Here&apos;s how the AI would sort them. Rename or remove folders, then apply: each folder becomes a study set.
          </p>
          <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
            {plan.map((folder, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-2xl border border-stroke p-3">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <input
                    className="input py-1.5 px-2.5 text-sm font-semibold"
                    value={folder.name}
                    onChange={(e) => setPlan(plan.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))}
                  />
                  <button onClick={() => setPlan(plan.filter((_, j) => j !== i))} className="icon-btn w-8 h-8 hover:text-red-500" title="Don't make this folder">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <ul className="mt-2 ml-6 flex flex-col gap-0.5">
                  {folder.file_ids.map((id) => (
                    <li key={id} className="text-sm text-muted truncate">
                      {names.get(id)}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={apply} className="btn-primary py-3" disabled={!!busy || plan.length === 0}>
            {busy === "applying" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            Make {plan.length} folder{plan.length === 1 ? "" : "s"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-red-500 py-4">{error || "Something went wrong."}</p>
      )}
    </Modal>
  );
}

function NameModal({
  isOpen,
  title,
  initial = "",
  placeholder,
  action,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  title: string;
  initial?: string;
  placeholder?: string;
  action: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isOpen) {
      setName(initial);
      setError("");
    }
  }, [isOpen, initial]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} locked={busy} title={title} icon={<FolderPlus className="w-5 h-5" />} width="max-w-sm">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit(name.trim());
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input className="input" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {action}
        </button>
      </form>
    </Modal>
  );
}

function SectionHead({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
        <p className="text-muted mt-1 max-w-2xl">{text}</p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/* ------------------------------ Edit course ------------------------------ */

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
          message={`Delete ${course.code || course.name}, with all its study sets, exams and files? This can't be undone.`}
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
