"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GraduationCap, Plus, Sparkles } from "lucide-react";
import CourseCard from "@/components/courses/CourseCard";
import { ImportCoursesModal, NewCourseModal } from "@/components/courses/CourseModals";
import EmptyState from "@/components/ui/EmptyState";
import { listCourses, type Course } from "@/lib/courses";

/** Every course, filterable by term, with AI import and manual creation. */
export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState("");
  const [term, setTerm] = useState<string>("All");
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = () => listCourses().then(setCourses, (e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const terms = useMemo(() => ["All", ...Array.from(new Set((courses ?? []).map((c) => c.term).filter(Boolean)))], [courses]);
  const shown = (courses ?? []).filter((c) => term === "All" || c.term === term);

  return (
    <div className="page">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Courses</h1>
            <p className="text-muted mt-1">Each course keeps its own study sets and files.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setImporting(true)} className="btn-primary">
              <Sparkles className="w-4 h-4" /> Import with AI
            </button>
            <button onClick={() => setCreating(true)} className="btn-secondary">
              <Plus className="w-4 h-4" /> New course
            </button>
          </div>
        </div>

        {terms.length > 2 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {terms.map((t) => (
              <button
                key={t}
                onClick={() => setTerm(t)}
                className={`relative px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  term === t ? "text-white" : "bg-surface border border-stroke text-muted hover:text-foreground"
                }`}
              >
                {term === t && (
                  <motion.span layoutId="term-pill" className="absolute inset-0 rounded-full bg-gradient-to-r from-brand to-brand-2" />
                )}
                <span className="relative">{t}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-red-500">{error}</p>}
        {courses === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton h-24" />
                <div className="p-5 flex flex-col gap-2">
                  <div className="skeleton h-3 w-20 rounded" />
                  <div className="skeleton h-5 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Add your courses"
            text="Paste your course list from your school's website and the AI sets them all up, or create one yourself."
            action="Import with AI"
            onAction={() => setImporting(true)}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c, i) => (
              <CourseCard key={c.id} course={c} index={i} />
            ))}
          </div>
        )}
      </div>

      <ImportCoursesModal isOpen={importing} onClose={() => setImporting(false)} onCreated={() => load()} />
      <NewCourseModal isOpen={creating} onClose={() => setCreating(false)} onCreated={(c) => router.push(`/courses/${c.id}`)} />
    </div>
  );
}
