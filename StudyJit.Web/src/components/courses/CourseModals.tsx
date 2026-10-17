"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, ClipboardPaste, GraduationCap, Loader2, Minus, Plus, Rocket, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import {
  autopilot,
  courseColors,
  createCourse,
  createCourses,
  parseCourses,
  type Course,
  type CourseDraft,
  type QuizSummary,
} from "@/lib/courses";

/* ------------------------------ New course ------------------------------ */

export function NewCourseModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (course: Course) => void;
}) {
  const [draft, setDraft] = useState({ code: "", name: "", term: "", color: "blue" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return setError("Give the course a name.");
    setBusy(true);
    setError("");
    try {
      const course = await createCourse(draft);
      setDraft({ code: "", name: "", term: "", color: "blue" });
      onCreated(course);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} locked={busy} title="New course" icon={<GraduationCap className="w-5 h-5" />}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <div>
            <label className="label">Code</label>
            <input className="input" placeholder="COMP 3760" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" placeholder="Algorithms" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </div>
        </div>
        <div>
          <label className="label">Term (optional)</label>
          <input className="input" placeholder="Fall 2026" value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })} />
        </div>
        <div>
          <label className="label">Colour</label>
          <div className="flex gap-2">
            {Object.entries(courseColors).map(([key, c]) => (
              <button
                type="button"
                key={key}
                onClick={() => setDraft({ ...draft, color: key })}
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${c.gradient} flex items-center justify-center transition ${
                  draft.color === key ? "ring-2 ring-offset-2 ring-offset-surface ring-brand scale-110" : "hover:scale-110"
                }`}
                aria-label={key}
              >
                {draft.color === key && <Check className="w-4 h-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Create course
        </button>
      </form>
    </Modal>
  );
}

/* ------------------------------ Import with AI ------------------------------ */

const example = `COMP 3760 - BBY - Algorithms (merge 202630 50121 46919)
Fall 2026
MATH-3042-0 - Applied Probability and Statistics - 50115
Fall 2026`;

/** Paste a course list from your school's site; the AI reads the courses out, you tick the ones to add. */
export function ImportCoursesModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (courses: Course[]) => void;
}) {
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<(CourseDraft & { keep: boolean })[] | null>(null);
  const [busy, setBusy] = useState<"reading" | "creating" | null>(null);
  const [error, setError] = useState("");

  const reset = () => {
    setText("");
    setDrafts(null);
    setError("");
  };

  const read = async () => {
    setBusy("reading");
    setError("");
    try {
      const found = await parseCourses(text);
      if (found.length === 0) setError("No courses found in that text. Try copying your course list again.");
      else setDrafts(found.map((c) => ({ ...c, keep: true })));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    const chosen = drafts?.filter((d) => d.keep && d.name.trim()) ?? [];
    if (!chosen.length) return setError("Pick at least one course.");
    setBusy("creating");
    setError("");
    try {
      const courses = await createCourses(chosen.map(({ code, name, term }) => ({ code, name, term })));
      onCreated(courses);
      reset();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const edit = (i: number, fields: Partial<CourseDraft & { keep: boolean }>) =>
    setDrafts((d) => d && d.map((row, j) => (j === i ? { ...row, ...fields } : row)));

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      locked={!!busy}
      title="Import courses with AI"
      icon={<Sparkles className="w-5 h-5" />}
      width="max-w-2xl"
    >
      <AnimatePresence mode="wait">
        {!drafts ? (
          <motion.div key="paste" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Copy your course list from your school&apos;s website (D2L, Moodle, Canvas, your timetable…) and paste it below. The AI
              cleans up the names, codes and terms. You can check them before anything is created.
            </p>
            <div className="relative">
              <textarea
                className="input font-mono text-sm min-h-56"
                placeholder={example}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!!busy}
                autoFocus
              />
              {!text && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setText(await navigator.clipboard.readText());
                    } catch {
                      setError("Couldn't read the clipboard. Paste with Ctrl+V instead.");
                    }
                  }}
                  className="absolute right-3 bottom-3 btn-secondary px-3 py-1.5 text-sm"
                >
                  <ClipboardPaste className="w-4 h-4" /> Paste
                </button>
              )}
            </div>
            {error && (
              <p className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}
            <button onClick={read} className="btn-primary py-3" disabled={!text.trim() || !!busy}>
              {busy === "reading" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
              {busy === "reading" ? "Reading your courses…" : "Find my courses"}
            </button>
          </motion.div>
        ) : (
          <motion.div key="review" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Found <b className="text-foreground">{drafts.length}</b> course{drafts.length === 1 ? "" : "s"}. Edit anything that&apos;s off and
              untick what you don&apos;t want.
            </p>
            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {drafts.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: d.keep ? 1 : 0.5, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 rounded-xl border border-stroke bg-surface-2/50 p-2"
                >
                  <button
                    onClick={() => edit(i, { keep: !d.keep })}
                    className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition ${
                      d.keep ? "bg-brand border-brand text-white" : "border-stroke"
                    }`}
                    aria-label={d.keep ? "Skip" : "Keep"}
                  >
                    {d.keep && <Check className="w-4 h-4" />}
                  </button>
                  <input className="input py-1.5 px-2.5 w-28 text-sm font-semibold" value={d.code} placeholder="Code" onChange={(e) => edit(i, { code: e.target.value })} />
                  <input className="input py-1.5 px-2.5 flex-1 text-sm" value={d.name} onChange={(e) => edit(i, { name: e.target.value })} />
                  <input className="input py-1.5 px-2.5 w-28 text-sm hidden sm:block" value={d.term} placeholder="Term" onChange={(e) => edit(i, { term: e.target.value })} />
                  <button onClick={() => setDrafts(drafts.filter((_, j) => j !== i))} className="icon-btn w-8 h-8 hover:text-red-500" aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
            {error && (
              <p className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setDrafts(null)} className="btn-secondary" disabled={!!busy}>
                Back
              </button>
              <button onClick={create} className="btn-primary flex-1" disabled={!!busy}>
                {busy === "creating" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Create {drafts.filter((d) => d.keep).length} course{drafts.filter((d) => d.keep).length === 1 ? "" : "s"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

/* ------------------------------ Autopilot ------------------------------ */

const steps = ["Reading your files", "Splitting the course into topics", "Writing study set briefs", "Queuing generation"];

/** Course autopilot: pick how many sets, and the AI plans and queues the whole course. */
export function AutopilotModal({
  isOpen,
  onClose,
  course,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  onDone: (created: QuizSummary[]) => void;
}) {
  const [sets, setSets] = useState(6);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 2)), 2200);
    try {
      const result = await autopilot(course.id, sets);
      setStep(steps.length - 1);
      setCreated(result);
      onDone(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  };

  const close = () => {
    setCreated(null);
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} locked={busy} title="Course autopilot" icon={<Rocket className="w-5 h-5" />} width="max-w-lg">
      {created ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 p-4">
            <span className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
              <Check className="w-5 h-5" />
            </span>
            <div>
              <p className="font-bold">{created.length} study sets on their way</p>
              <p className="text-sm text-muted">They&apos;re generating one after another; each unlocks when it&apos;s ready.</p>
            </div>
          </div>
          <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {created.map((q, i) => (
              <motion.li
                key={q.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-stroke p-3"
              >
                <p className="font-semibold">{q.name}</p>
                {q.description && <p className="text-sm text-muted">{q.description}</p>}
              </motion.li>
            ))}
          </ul>
          <button onClick={close} className="btn-primary">
            Done
          </button>
        </div>
      ) : busy ? (
        <div className="flex flex-col gap-3 py-2">
          {steps.map((s, i) => (
            <motion.div key={s} initial={{ opacity: 0.4 }} animate={{ opacity: i <= step ? 1 : 0.4 }} className="flex items-center gap-3">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  i < step ? "bg-emerald-500 text-white" : i === step ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted"
                }`}
              >
                {i < step ? <Check className="w-4 h-4" /> : i === step ? <Loader2 className="w-4 h-4 animate-spin" /> : i + 1}
              </span>
              <span className={i === step ? "font-semibold" : ""}>{s}</span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-muted">
            The AI looks at {course.file_count ? `the ${course.file_count} file${course.file_count === 1 ? "" : "s"} in this course` : "what this course usually covers"},
            splits it into topics and builds a study set for each, plus a final review, with quizzes, flashcards and study guides.
          </p>
          {course.file_count === 0 && (
            <p className="flex gap-2 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> No files yet: the sets will be based on the course name alone. Upload lecture
              notes first for sets that match your class.
            </p>
          )}
          <div>
            <label className="label">Study sets</label>
            <div className="flex items-center gap-4">
              <button className="icon-btn border border-stroke" onClick={() => setSets(Math.max(1, sets - 1))}>
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center text-3xl font-extrabold text-brand tabular-nums">{sets}</span>
              <button className="icon-btn border border-stroke" onClick={() => setSets(Math.min(12, sets + 1))}>
                <Plus className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted">at most</span>
            </div>
          </div>
          {error && (
            <p className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          <button onClick={run} className="btn-primary py-3">
            <Rocket className="w-5 h-5" /> Build my course
          </button>
        </div>
      )}
    </Modal>
  );
}
