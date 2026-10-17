"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Brain, GraduationCap, Layers, Loader2, Plus, Sparkles, Target, Trophy } from "lucide-react";
import CourseCard from "@/components/courses/CourseCard";
import { ImportCoursesModal, NewCourseModal } from "@/components/courses/CourseModals";
import ScoreRing from "@/components/ui/ScoreRing";
import { userName } from "@/lib/api";
import { colorOf, courseQuizzes, listCourses, type Course, type QuizSummary } from "@/lib/courses";
import { studyHref } from "@/lib/modes";

/** Home: a greeting, progress at a glance, what to study next and the user's courses. */
export default function HomePage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const load = () => {
    listCourses().then(setCourses, () => setCourses([]));
    courseQuizzes("all").then(setQuizzes, () => setQuizzes([]));
  };
  useEffect(() => {
    setName(userName().split(" ")[0]);
    load();
  }, []);

  const ready = quizzes.filter((q) => q.generation_status === "success" && q.questions.length > 0);
  const generating = quizzes.filter((q) => q.generation_status === "queued" || q.generation_status === "pending").length;
  const scored = ready.filter((q) => q.last_score != null);
  const average = scored.length ? scored.reduce((s, q) => s + Number(q.last_score), 0) / scored.length : null;
  // Next up: sets never studied first, then the weakest scores.
  const nextUp = useMemo(
    () =>
      [...ready]
        .sort((a, b) => (a.last_score == null ? -1 : b.last_score == null ? 1 : Number(a.last_score) - Number(b.last_score)))
        .slice(0, 4),
    [ready]
  );
  const courseOf = (q: QuizSummary) => courses?.find((c) => c.id === q.course_id);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const open = (q: QuizSummary) => {
    sessionStorage.setItem("selectedQuizId", String(q.id));
    router.push(`/quizDetails/${encodeURIComponent(q.name)}`);
  };

  return (
    <div className="page">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {greeting}
            {name ? `, ${name}` : ""} 👋
          </h1>
          <p className="text-muted mt-1">
            {generating > 0
              ? `${generating} study set${generating === 1 ? " is" : "s are"} being generated for you right now.`
              : nextUp.length
              ? "Here's what to study next."
              : "Let's get your courses set up."}
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Courses", value: courses?.length ?? "–", icon: GraduationCap, tone: "from-brand to-brand-2" },
            { label: "Study sets ready", value: ready.length, icon: BookOpen, tone: "from-emerald-500 to-teal-400" },
            { label: "Generating", value: generating, icon: generating ? Loader2 : Sparkles, tone: "from-amber-500 to-orange-400", spin: generating > 0 },
            { label: "Average score", value: average != null ? `${Math.round(average)}%` : "–", icon: Trophy, tone: "from-violet-500 to-fuchsia-500" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card p-5 flex items-center gap-4"
            >
              <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.tone} text-white flex items-center justify-center shadow-md`}>
                <s.icon className={`w-6 h-6 ${s.spin ? "animate-spin" : ""}`} />
              </span>
              <div>
                <p className="text-2xl font-extrabold tabular-nums">{s.value}</p>
                <p className="text-xs font-semibold text-muted">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Study next */}
        {nextUp.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Study next</h2>
              <Link href="/courses" className="text-sm font-semibold text-brand hover:underline flex items-center gap-1">
                All courses <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {nextUp.map((q, i) => {
                const course = courseOf(q);
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="card card-hover p-5 flex flex-col gap-3 cursor-pointer"
                    onClick={() => open(q)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {course && <p className={`text-xs font-extrabold tracking-wider truncate ${colorOf(course).text}`}>{course.code || course.name}</p>}
                        <p className="font-bold leading-snug line-clamp-2">{q.name}</p>
                      </div>
                      {q.last_score != null ? (
                        <ScoreRing percent={Number(q.last_score)} size={44} stroke={5} animated={false} />
                      ) : (
                        <span className="chip bg-brand-soft text-brand flex-shrink-0">New</span>
                      )}
                    </div>
                    <div className="mt-auto flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {[
                        { mode: "learn" as const, icon: Brain, label: "Learn" },
                        { mode: "flashcards" as const, icon: Layers, label: "Cards" },
                        { mode: "practice" as const, icon: Target, label: "Quiz" },
                      ].map((m) => (
                        <button
                          key={m.mode}
                          onClick={() => router.push(studyHref(q.id, m.mode))}
                          className="flex-1 btn-secondary px-2 py-1.5 text-xs"
                        >
                          <m.icon className="w-3.5 h-3.5" /> {m.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Courses */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Your courses</h2>
            {courses && courses.length > 0 && (
              <Link href="/courses" className="text-sm font-semibold text-brand hover:underline flex items-center gap-1">
                All courses <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {courses === null ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card h-52 skeleton" />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.slice(0, 5).map((c, i) => (
                <CourseCard key={c.id} course={c} index={i} />
              ))}
              {/* The AI import as a card of its own */}
              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setImporting(true)}
                className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-brand/40 p-6 text-left min-h-52 flex flex-col justify-between hover:border-brand hover:bg-brand-soft/40 transition"
              >
                <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-gradient-to-br from-brand/20 to-brand-2/20 blur-2xl transition group-hover:scale-125" />
                <span className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white flex items-center justify-center shadow-lg group-hover:rotate-6 transition">
                  <Sparkles className="w-6 h-6" />
                </span>
                <div className="relative">
                  <p className="font-bold text-lg">{courses.length ? "Add more courses with AI" : "Import your courses with AI"}</p>
                  <p className="text-sm text-muted mt-1">Paste your course list from your school&apos;s site. The AI sets them up for you.</p>
                </div>
              </motion.button>
              {courses.length === 0 && (
                <motion.button
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28 }}
                  onClick={() => setCreating(true)}
                  className="rounded-2xl border-2 border-dashed border-stroke p-6 text-left min-h-52 flex flex-col justify-between hover:border-brand/50 transition"
                >
                  <span className="w-12 h-12 rounded-2xl bg-surface-2 text-muted flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                  </span>
                  <div>
                    <p className="font-bold text-lg">Create a course</p>
                    <p className="text-sm text-muted mt-1">Type in the code and name yourself.</p>
                  </div>
                </motion.button>
              )}
            </div>
          )}
        </section>
      </div>

      <ImportCoursesModal isOpen={importing} onClose={() => setImporting(false)} onCreated={() => load()} />
      <NewCourseModal isOpen={creating} onClose={() => setCreating(false)} onCreated={(c) => router.push(`/courses/${c.id}`)} />
    </div>
  );
}
