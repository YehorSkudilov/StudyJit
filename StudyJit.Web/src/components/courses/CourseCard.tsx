"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, FileText, GraduationCap, Loader2 } from "lucide-react";
import { colorOf, type Course } from "@/lib/courses";

/** A course tile: its colour banner, code and name, and how far along its study sets are. */
export default function CourseCard({ course, index = 0 }: { course: Course; index?: number }) {
  const color = colorOf(course);
  const progress = course.quiz_count ? course.ready_count / course.quiz_count : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.05, duration: 0.35 }}
    >
      <Link href={`/courses/${course.id}`} className="group card card-hover block overflow-hidden h-full">
        <div className={`relative h-24 bg-gradient-to-br ${color.gradient} p-4 overflow-hidden`}>
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 transition duration-500 group-hover:scale-125" />
          <div className="absolute right-6 bottom-[-18px] h-16 w-16 rounded-full bg-white/10 transition duration-500 group-hover:-translate-y-2" />
          <GraduationCap className="relative w-7 h-7 text-white/90" />
          {course.term && (
            <span className="absolute right-3 top-3 chip bg-white/20 text-white backdrop-blur">{course.term}</span>
          )}
        </div>
        <div className="p-5">
          {course.code && <p className={`text-xs font-extrabold tracking-wider ${color.text}`}>{course.code}</p>}
          <h3 className="mt-0.5 font-bold text-lg leading-snug line-clamp-2">{course.name}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> {course.quiz_count} study set{course.quiz_count === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> {course.file_count} file{course.file_count === 1 ? "" : "s"}
            </span>
            {course.generating_count > 0 && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {course.generating_count} generating
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${color.gradient}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ delay: 0.3 + index * 0.05, duration: 0.8 }}
              />
            </div>
            <span className="text-xs font-semibold text-muted tabular-nums">
              {course.average_score != null ? `${Math.round(Number(course.average_score))}% avg` : `${course.ready_count}/${course.quiz_count} ready`}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
