'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  Layers,
  Menu,
  ScrollText,
  X,
  type LucideIcon,
} from 'lucide-react';
import AccountMenu from '@/components/AccountMenu';
import Logo from '@/components/ui/Logo';
import { colorOf, courseHref, courseSections, listCourses, type Course, type CourseSection } from '@/lib/courses';

const appTabs = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/courses', label: 'Courses', icon: GraduationCap },
];

const sectionIcons: Record<CourseSection, LucideIcon> = {
  '': LayoutDashboard,
  sets: BookOpen,
  flashcards: Layers,
  cheatsheets: ScrollText,
  exam: ClipboardCheck,
  files: FileText,
};

/** The course (and section) the page belongs to: from /courses/{id}/{section}, or the last course opened for a study set. */
function courseContext(pathname: string): { id: number; section: CourseSection } | null {
  const match = /^\/courses\/(\d+)(?:\/([a-z]+))?/.exec(pathname);
  if (match) return { id: Number(match[1]), section: (match[2] ?? '') as CourseSection };
  if (pathname.startsWith('/quizDetails')) {
    const saved = typeof window !== 'undefined' ? Number(sessionStorage.getItem('currentCourseId')) : 0;
    if (saved) return { id: saved, section: 'sets' };
  }
  return null;
}

export default function Navbar() {
  const pathname = usePathname() ?? '';
  const [menuOpen, setMenuOpen] = useState(false);
  const [context, setContext] = useState<ReturnType<typeof courseContext>>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    const ctx = courseContext(pathname);
    setContext(ctx);
    if (ctx && pathname.startsWith('/courses/')) sessionStorage.setItem('currentCourseId', String(ctx.id));
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (context) listCourses().then(setCourses, () => setCourses([]));
  }, [context?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const course = context ? courses.find((c) => c.id === context.id) : undefined;
  const tabs = context
    ? courseSections.map((s) => ({ href: courseHref(context.id, s.key), label: s.label, icon: sectionIcons[s.key], active: context.section === s.key }))
    : appTabs.map((t) => ({ ...t, active: pathname === t.href }));

  return (
    <nav className="print:hidden sticky top-0 z-[5000] w-full border-b border-stroke/70 bg-surface/75 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl h-16 px-4 sm:px-6 flex items-center gap-3">
        <Link href="/home" className="flex items-center transition hover:opacity-80 flex-shrink-0">
          <Logo size={34} showName={!context} />
        </Link>

        {context && <CourseSwitcher course={course} courses={courses} />}

        {/* Tabs, with a pill that slides to the active one */}
        <ul className={`hidden lg:flex items-center gap-1 rounded-full bg-surface-2 p-1 ${context ? 'ml-2' : 'mx-auto'}`}>
          {tabs.map((tab) => (
            <li key={tab.href} className="relative">
              {tab.active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-surface shadow-sm"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Link
                href={tab.href}
                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                  tab.active ? 'text-brand' : 'text-muted hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="icon-btn lg:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <AccountMenu />
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden overflow-hidden px-4 border-t border-stroke"
          >
            {[...tabs, ...(context ? appTabs.map((t) => ({ ...t, active: false })) : [])].map((tab, i) => (
              <li key={tab.href + i} className="py-0.5 first:pt-3 last:pb-3">
                <Link
                  href={tab.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold transition ${
                    tab.active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </nav>
  );
}

/** The current course, opening a list to jump to another. */
function CourseSwitcher({ course, courses }: { course?: Course; courses: Course[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 hover:bg-surface-2 transition min-w-0"
      >
        <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${course ? colorOf(course).gradient : 'from-slate-400 to-slate-300'} flex-shrink-0 flex items-center justify-center`}>
          <GraduationCap className="w-4 h-4 text-white" />
        </span>
        <span className="font-bold truncate max-w-[10rem] sm:max-w-[14rem]">{course ? course.code || course.name : '…'}</span>
        <ChevronDown className={`w-4 h-4 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: 'top left' }}
            className="absolute left-0 mt-2 w-80 card p-1.5 z-[3000] max-h-[70vh] overflow-y-auto"
          >
            {courses.map((c) => (
              <Link
                key={c.id}
                href={courseHref(c.id)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition"
              >
                <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${colorOf(c).gradient} flex-shrink-0`} />
                <span className="min-w-0 flex-1">
                  {c.code && <span className={`block text-xs font-extrabold ${colorOf(c).text}`}>{c.code}</span>}
                  <span className="block text-sm font-semibold truncate">{c.name}</span>
                </span>
                {c.id === course?.id && <Check className="w-4 h-4 text-brand" />}
              </Link>
            ))}
            <hr className="border-stroke my-1.5" />
            <Link href="/courses" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-surface-2 hover:text-foreground">
              <GraduationCap className="w-4 h-4" /> All courses
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
