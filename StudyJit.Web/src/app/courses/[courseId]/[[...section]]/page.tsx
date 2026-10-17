"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  ClipboardCheck,
  Copy,
  FileText,
  Layers,
  Loader2,
  PenLine,
  Pencil,
  Plus,
  Printer,
  Puzzle,
  Rocket,
  ScrollText,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  Wand2,
  Zap,
} from "lucide-react";
import QuizCard from "@/components/QuizCard";
import CreateQuizPopup from "@/components/CreateQuizPopup";
import FileUploadPopup from "@/components/FileUploadPopup";
import AlertPopup from "@/components/AlertPopup";
import Modal from "@/components/ui/Modal";
import Markdown from "@/components/ui/Markdown";
import EmptyState from "@/components/ui/EmptyState";
import ScoreRing from "@/components/ui/ScoreRing";
import { AutopilotModal } from "@/components/courses/CourseModals";
import {
  cheatSheets,
  colorOf,
  courseColors,
  courseFiles,
  courseHref,
  courseQuizzes,
  courseStudy,
  createCheatSheet,
  createQuiz,
  deleteCheatSheet,
  deleteCourse,
  deleteFiles,
  formatBytes,
  getCourse,
  updateCourse,
  uploadFile,
  uploadYouTube,
  type CheatSheet,
  type Course,
  type CourseFile,
  type CourseSection,
  type QuizSummary,
} from "@/lib/courses";
import type { StudyMode, Term } from "@/lib/study";

/** Course-wide study sessions run at /study/c{courseId}/{mode}. */
const courseStudyHref = (courseId: number, mode: StudyMode) => `/study/c${courseId}/${mode}`;

/** /courses/{id}/{section}: one course. The navbar shows its sections as tabs. */
export default function CoursePage() {
  const params = useParams<{ courseId: string; section?: string[] }>();
  const id = Number(params.courseId);
  const section = (params.section?.[0] ?? "") as CourseSection;
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [files, setFiles] = useState<CourseFile[] | null>(null);
  const [error, setError] = useState("");
  const [alert, setAlert] = useState<string | null>(null);

  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const [newSetOpen, setNewSetOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
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
    sessionStorage.setItem("currentCourseId", String(id));
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
        <div className="skeleton h-40 rounded-3xl" />
      </div>
    );

  const color = colorOf(course);
  const ready = (quizzes ?? []).filter((q) => q.generation_status === "success");

  return (
    <div className="page">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Banner */}
        <motion.section
          layout
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`print:hidden relative overflow-hidden rounded-3xl bg-gradient-to-br ${color.gradient} text-white shadow-xl ${
            section ? "px-6 py-5" : "p-6 sm:p-8"
          }`}
        >
          <div className="animate-drift absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-sm" />
          <div className="absolute right-24 -bottom-20 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {course.code && <span className="chip bg-white/20 backdrop-blur text-white">{course.code}</span>}
                {course.term && <span className="chip bg-white/20 backdrop-blur text-white">{course.term}</span>}
              </div>
              <h1 className={`${section ? "text-2xl" : "text-3xl sm:text-4xl"} font-extrabold tracking-tight truncate`}>{course.name}</h1>
              {!section && (
                <p className="mt-2 text-white/80">
                  {course.quiz_count} study set{course.quiz_count === 1 ? "" : "s"} · {course.file_count} file{course.file_count === 1 ? "" : "s"}
                  {course.generating_count > 0 && ` · ${course.generating_count} generating`}
                </p>
              )}
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

        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mt-8"
          >
            {section === "" && (
              <Overview
                course={course}
                quizzes={quizzes ?? []}
                files={files ?? []}
                onAutopilot={() => setAutopilotOpen(true)}
                onUpload={() => setUploadOpen(true)}
                onNewSet={() => setNewSetOpen(true)}
                onOpen={openQuiz}
              />
            )}
            {section === "sets" && (
              <SetsSection
                quizzes={quizzes}
                onNew={() => setNewSetOpen(true)}
                onAutopilot={() => setAutopilotOpen(true)}
                onOpen={openQuiz}
              />
            )}
            {section === "flashcards" && <FlashcardsSection course={course} readySets={ready.length} />}
            {section === "cheatsheets" && <CheatSheetsSection course={course} readySets={ready.length} />}
            {section === "exam" && <ExamSection course={course} quizzes={quizzes ?? []} onOpen={openQuiz} />}
            {section === "files" && (
              <FilesSection
                files={files ?? []}
                onUpload={() => setUploadOpen(true)}
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
          router.push(courseHref(id, "sets"));
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

/* ------------------------------ Overview ------------------------------ */

function Overview({
  course,
  quizzes,
  files,
  onAutopilot,
  onUpload,
  onNewSet,
  onOpen,
}: {
  course: Course;
  quizzes: QuizSummary[];
  files: CourseFile[];
  onAutopilot: () => void;
  onUpload: () => void;
  onNewSet: () => void;
  onOpen: (q: QuizSummary) => void;
}) {
  const ready = quizzes.filter((q) => q.generation_status === "success");
  const scored = ready.filter((q) => q.last_score != null);
  const average = scored.length ? scored.reduce((s, q) => s + Number(q.last_score), 0) / scored.length : null;

  const shortcuts = [
    { section: "flashcards" as const, title: "Flashcards", text: "Every key term in the course", icon: Layers, tone: "from-sky-500 to-cyan-400" },
    { section: "cheatsheets" as const, title: "Cheat sheets", text: "AI-condensed, printable notes", icon: ScrollText, tone: "from-slate-600 to-slate-400" },
    { section: "exam" as const, title: "Exam prep", text: "Mock exams across all topics", icon: ClipboardCheck, tone: "from-blue-600 to-indigo-500" },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_20rem] gap-6 items-start">
      <div className="flex flex-col gap-6">
        {quizzes.length === 0 && (
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
                  <button onClick={onUpload} className="btn-secondary">
                    <UploadCloud className="w-4 h-4" /> Upload files
                  </button>
                )}
                <button onClick={onAutopilot} className="btn-primary">
                  <Rocket className="w-4 h-4" /> Run autopilot
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          {shortcuts.map((s, i) => (
            <motion.div key={s.section} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Link href={courseHref(course.id, s.section)} className="group card card-hover p-5 flex flex-col gap-3 h-full">
                <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${s.tone} text-white flex items-center justify-center shadow-md transition group-hover:scale-110 group-hover:-rotate-3`}>
                  <s.icon className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-bold">{s.title}</p>
                  <p className="text-sm text-muted">{s.text}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">Study sets</h2>
            {quizzes.length > 0 && (
              <Link href={courseHref(course.id, "sets")} className="text-sm font-semibold text-brand hover:underline">
                See all {quizzes.length}
              </Link>
            )}
          </div>
          {quizzes.length === 0 ? (
            <button
              onClick={onNewSet}
              className="w-full rounded-2xl border-2 border-dashed border-stroke py-10 text-muted hover:border-brand/50 hover:text-brand transition flex flex-col items-center gap-2"
            >
              <Plus className="w-7 h-7" />
              <span className="font-semibold">Make a study set yourself</span>
            </button>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {quizzes.slice(0, 4).map((q) => (
                <QuizCard
                  key={q.id}
                  quizName={q.name}
                  description={q.description}
                  lastScore={q.last_score}
                  status={q.generation_status}
                  questionCount={q.questions.length}
                  selected={false}
                  onClick={() => onOpen(q)}
                  onDoubleClick={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>

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
            { label: "Files", value: files.length },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-surface-2 p-2.5">
              <p className="text-xl font-extrabold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Study sets ------------------------------ */

function SetsSection({
  quizzes,
  onNew,
  onAutopilot,
  onOpen,
}: {
  quizzes: QuizSummary[] | null;
  onNew: () => void;
  onAutopilot: () => void;
  onOpen: (q: QuizSummary) => void;
}) {
  return (
    <>
      <SectionHead title="Study sets" text="Quizzes with flashcards, games and a study guide for each topic.">
        <button onClick={onNew} className="btn-primary">
          <Plus className="w-4 h-4" /> New study set
        </button>
        <button onClick={onAutopilot} className="btn-secondary">
          <Rocket className="w-4 h-4" /> Autopilot
        </button>
      </SectionHead>
      {quizzes && quizzes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No study sets yet"
          text="Make one yourself, or run Autopilot to have the AI build the whole course from your files."
          action="New study set"
          onAction={onNew}
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

/* ------------------------------ Flashcards ------------------------------ */

function FlashcardsSection({ course, readySets }: { course: Course; readySets: number }) {
  const router = useRouter();
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");

  useEffect(() => {
    courseStudy(course.id).then(
      (m) => setTerms(m.terms.length >= 4 ? m.terms : m.questions.map((q) => ({ term: q.correct, definition: q.question }))),
      () => setTerms([])
    );
  }, [course.id]);

  const shown = (terms ?? []).filter((t) => !filter || `${t.term} ${t.definition}`.toLowerCase().includes(filter.toLowerCase()));
  const modes = [
    { mode: "flashcards" as const, label: "Flashcards", icon: Layers },
    { mode: "learn" as const, label: "Learn", icon: Brain },
    { mode: "match" as const, label: "Match", icon: Puzzle },
    { mode: "write" as const, label: "Write", icon: PenLine },
  ];

  return (
    <>
      <SectionHead
        title="Flashcards"
        text={terms ? `${terms.length} cards from ${readySets} study set${readySets === 1 ? "" : "s"}. Tap a card to flip it.` : "Loading…"}
      >
        {terms && terms.length > 0 &&
          modes.map((m, i) => (
            <button key={m.mode} onClick={() => router.push(courseStudyHref(course.id, m.mode))} className={i === 0 ? "btn-primary" : "btn-secondary"}>
              <m.icon className="w-4 h-4" /> {m.label}
            </button>
          ))}
      </SectionHead>

      {terms === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      ) : terms.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No cards yet"
          text="Flashcards come from your study sets' key terms. Generate a study set (or run Autopilot) and they'll show up here."
        />
      ) : (
        <>
          <input className="input mb-5 max-w-sm" placeholder="Search cards" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t, i) => {
              const isFlipped = flipped.has(i);
              return (
                <motion.button
                  key={`${t.term}-${i}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 15) * 0.02 }}
                  onClick={() => setFlipped((f) => {
                    const next = new Set(f);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })}
                  className="perspective h-36 text-left"
                >
                  <motion.div
                    className="relative w-full h-full preserve-3d"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  >
                    <div className="absolute inset-0 backface-hidden card p-5 flex items-center justify-center text-center">
                      <p className="font-bold text-lg leading-snug line-clamp-4">{t.term}</p>
                    </div>
                    <div className="absolute inset-0 backface-hidden card p-5 flex items-center justify-center text-center [transform:rotateY(180deg)] bg-gradient-to-br from-brand-soft to-surface">
                      <p className="text-sm leading-snug line-clamp-5">{t.definition}</p>
                    </div>
                  </motion.div>
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------ Cheat sheets ------------------------------ */

function CheatSheetsSection({ course, readySets }: { course: Course; readySets: number }) {
  const [sheets, setSheets] = useState<CheatSheet[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [focus, setFocus] = useState("");
  const [detailed, setDetailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    cheatSheets(course.id).then(
      (s) => {
        setSheets(s);
        setSelected(s[0]?.id ?? null);
      },
      () => setSheets([])
    );
  }, [course.id]);

  const sheet = sheets?.find((s) => s.id === selected);

  const write = async () => {
    setBusy(true);
    setError("");
    try {
      const made = await createCheatSheet(course.id, focus, detailed);
      setSheets((s) => [made, ...(s ?? [])]);
      setSelected(made.id);
      setCreating(false);
      setFocus("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: CheatSheet) => {
    await deleteCheatSheet(course.id, s.id).catch(() => {});
    const rest = (sheets ?? []).filter((x) => x.id !== s.id);
    setSheets(rest);
    setSelected(rest[0]?.id ?? null);
  };

  return (
    <>
      <SectionHead title="Cheat sheets" text="Condensed notes the AI writes from everything in this course, ready to skim or print.">
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Wand2 className="w-4 h-4" /> New cheat sheet
        </button>
      </SectionHead>

      {sheets === null ? (
        <div className="skeleton h-96 rounded-2xl" />
      ) : sheets.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No cheat sheets yet"
          text={
            readySets
              ? `The AI can condense your ${readySets} study set${readySets === 1 ? "" : "s"} into one page of the essentials: key terms, formulas, rules and common mistakes.`
              : "Generate a study set first for a cheat sheet that matches your class, or write one now from the course name alone."
          }
          action="Write a cheat sheet"
          onAction={() => setCreating(true)}
        />
      ) : (
        <div className="grid lg:grid-cols-[16rem_1fr] gap-6 items-start">
          <div className="flex flex-col gap-2 print:hidden">
            {sheets.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`text-left rounded-xl px-4 py-3 border transition ${
                  s.id === selected ? "border-brand bg-brand-soft" : "border-stroke bg-surface hover:bg-surface-2"
                }`}
              >
                <p className={`font-semibold leading-snug ${s.id === selected ? "text-brand" : ""}`}>{s.title}</p>
                <p className="text-xs text-muted mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
          {sheet && (
            <motion.article key={sheet.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-10 print:shadow-none print:border-0">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className={`text-xs font-extrabold tracking-wider ${colorOf(course).text}`}>{course.code || course.name}</p>
                  <h2 className="text-2xl font-extrabold">{sheet.title}</h2>
                  {sheet.focus && <p className="text-sm text-muted mt-1">Focus: {sheet.focus}</p>}
                </div>
                <div className="flex gap-1 print:hidden">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(sheet.content).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="icon-btn"
                    title="Copy"
                  >
                    {copied ? <Sparkles className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => window.print()} className="icon-btn" title="Print">
                    <Printer className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(sheet)} className="icon-btn hover:text-red-500 hover:bg-red-500/10" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="columns-1 xl:columns-2 gap-10 [&_h2]:break-after-avoid">
                <Markdown text={sheet.content} />
              </div>
            </motion.article>
          )}
        </div>
      )}

      <Modal isOpen={creating} onClose={() => setCreating(false)} locked={busy} title="New cheat sheet" icon={<ScrollText className="w-5 h-5" />}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Focus (optional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="e.g. Only what's on the midterm: weeks 1–6. Include all formulas."
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: false, title: "One page", text: "The essentials" },
              { value: true, title: "Detailed", text: "More depth" },
            ].map((o) => (
              <button
                key={String(o.value)}
                type="button"
                onClick={() => setDetailed(o.value)}
                className={`rounded-xl border-2 p-3 text-left transition ${detailed === o.value ? "border-brand bg-brand-soft" : "border-stroke hover:border-brand/40"}`}
              >
                <p className={`font-semibold ${detailed === o.value ? "text-brand" : ""}`}>{o.title}</p>
                <p className="text-xs text-muted">{o.text}</p>
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={write} className="btn-primary py-3" disabled={busy}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {busy ? "Writing your cheat sheet…" : "Write it"}
          </button>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------ Exam prep ------------------------------ */

function ExamSection({ course, quizzes, onOpen }: { course: Course; quizzes: QuizSummary[]; onOpen: (q: QuizSummary) => void }) {
  const router = useRouter();
  const ready = quizzes.filter((q) => q.generation_status === "success" && q.questions.length > 0);
  const total = ready.reduce((n, q) => n + q.questions.length, 0);
  const weakest = [...ready]
    .sort((a, b) => (a.last_score == null ? -1 : b.last_score == null ? 1 : Number(a.last_score) - Number(b.last_score)))
    .slice(0, 5);

  if (ready.length === 0)
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Nothing to practise yet"
        text="Exam prep mixes questions from all your study sets. Generate at least one study set first."
      />
    );

  const activities = [
    {
      mode: "test" as const,
      title: "Mock exam",
      text: `A timed test mixing multiple choice, true/false and written questions from all ${total} questions in the course.`,
      icon: ClipboardCheck,
      tone: "from-blue-600 to-indigo-500",
    },
    { mode: "practice" as const, title: "Practice everything", text: "Every question in the course, one at a time, with explanations.", icon: Target, tone: "from-emerald-500 to-teal-400" },
    { mode: "truefalse" as const, title: "True or False blitz", text: "60 seconds of rapid-fire questions from across the course.", icon: Zap, tone: "from-rose-500 to-pink-500" },
    { mode: "learn" as const, title: "Learn it all", text: "Adaptive rounds over the whole course until it's mastered.", icon: Brain, tone: "from-violet-500 to-fuchsia-500" },
  ];

  return (
    <>
      <SectionHead title="Exam prep" text={`Study the whole of ${course.code || course.name} at once: ${ready.length} study sets, ${total} questions.`} />
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {activities.map((a, i) => (
          <motion.button
            key={a.mode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => router.push(courseStudyHref(course.id, a.mode))}
            className={`group card card-hover text-left p-6 flex gap-4 items-start ${i === 0 ? "sm:col-span-2" : ""}`}
          >
            <span className={`w-12 h-12 flex-shrink-0 rounded-2xl bg-gradient-to-br ${a.tone} text-white flex items-center justify-center shadow-md transition group-hover:scale-110 group-hover:-rotate-3`}>
              <a.icon className="w-6 h-6" />
            </span>
            <div>
              <p className="font-bold text-lg">{a.title}</p>
              <p className="text-sm text-muted mt-0.5">{a.text}</p>
            </div>
          </motion.button>
        ))}
      </div>

      <h3 className="font-bold text-lg mb-3">Focus on your weakest topics</h3>
      <div className="card divide-y divide-stroke overflow-hidden">
        {weakest.map((q) => (
          <div key={q.id} className="flex items-center gap-4 px-5 py-3.5">
            {q.last_score != null ? (
              <ScoreRing percent={Number(q.last_score)} size={42} stroke={5} animated={false} />
            ) : (
              <span className="w-[42px] h-[42px] rounded-full bg-brand-soft text-brand text-[10px] font-bold flex items-center justify-center">NEW</span>
            )}
            <button onClick={() => onOpen(q)} className="flex-1 min-w-0 text-left">
              <p className="font-semibold truncate hover:text-brand transition">{q.name}</p>
              <p className="text-xs text-muted">{q.last_score == null ? "Not studied yet" : `Last score ${Math.round(Number(q.last_score))}%`}</p>
            </button>
            <button onClick={() => router.push(`/study/${q.id}/practice`)} className="btn-secondary px-3 py-1.5 text-sm">
              <Target className="w-4 h-4" /> Practise
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------ Files ------------------------------ */

function FilesSection({ files, onUpload, onDelete }: { files: CourseFile[]; onUpload: () => void; onDelete: (ids: number[]) => Promise<void> }) {
  const [confirm, setConfirm] = useState<CourseFile | null>(null);
  return (
    <>
      <SectionHead title="Files" text="Lecture slides, notes, readings and videos. Study sets, Autopilot and cheat sheets are built from them.">
        <button onClick={onUpload} className="btn-primary">
          <UploadCloud className="w-4 h-4" /> Upload
        </button>
      </SectionHead>
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
                  className="icon-btn sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 hover:bg-red-500/10"
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

function SectionHead({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 print:hidden">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
        <p className="text-muted mt-1">{text}</p>
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
          message={`Delete ${course.code || course.name}, with all its study sets, cheat sheets and files? This can't be undone.`}
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
