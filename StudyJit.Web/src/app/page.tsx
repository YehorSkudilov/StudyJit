"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenText,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Layers,
  PenLine,
  Puzzle,
  Sparkles,
  Target,
  Timer,
  UploadCloud,
  Zap,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import { isSignedIn } from "@/lib/api";
import { useEffect, useState } from "react";

const modes = [
  { icon: Brain, title: "Learn", text: "Adaptive rounds that bring back what you miss until you've mastered it.", color: "from-violet-500 to-fuchsia-500" },
  { icon: Layers, title: "Flashcards", text: "Flip, swipe and sort key terms into “know it” and “still learning”.", color: "from-sky-500 to-cyan-400" },
  { icon: Target, title: "Practice", text: "One question at a time with instant feedback and explanations.", color: "from-emerald-500 to-teal-400" },
  { icon: ClipboardCheck, title: "Test", text: "Mix multiple choice, true/false and written questions, with a timer.", color: "from-blue-600 to-indigo-500" },
  { icon: Puzzle, title: "Match", text: "Race the clock pairing terms with their definitions.", color: "from-amber-500 to-orange-500" },
  { icon: Zap, title: "True or False", text: "A 60-second blitz: build a combo, beat your best.", color: "from-rose-500 to-pink-500" },
  { icon: PenLine, title: "Write", text: "Type the answer from memory, the strongest way to remember.", color: "from-lime-500 to-green-500" },
  { icon: BookOpenText, title: "Study guide", text: "An AI summary and glossary of everything you uploaded.", color: "from-slate-600 to-slate-400" },
];

const steps = [
  { icon: UploadCloud, title: "Upload your material", text: "PDFs, slides, docs, images or text: your lecture notes, as they are." },
  { icon: Sparkles, title: "AI builds your study set", text: "Questions with explanations, key terms and a study guide, in about a minute." },
  { icon: Timer, title: "Study your way", text: "Eight study modes, from quick flashcards to full timed tests." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(isSignedIn()), []);
  const startHref = signedIn ? "/learningSpace" : "/login";

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Soft moving background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-drift absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand/25 blur-3xl" />
        <div className="animate-drift absolute top-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-brand-2/25 blur-3xl [animation-delay:-6s]" />
        <div className="animate-drift absolute top-[60rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-violet-500/15 blur-3xl [animation-delay:-12s]" />
      </div>

      {/* Header */}
      <header className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between">
        <Logo size={38} />
        <div className="flex items-center gap-2">
          {!signedIn && (
            <Link href="/login" className="btn-ghost">
              Log in
            </Link>
          )}
          <Link href={startHref} className="btn-primary">
            {signedIn ? "Open my space" : "Get started"}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-7xl px-6 pt-10 pb-24 grid lg:grid-cols-2 gap-14 items-center">
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }}>
          <motion.span variants={fadeUp} className="chip bg-brand-soft text-brand mb-6">
            <Sparkles className="w-3.5 h-3.5" /> AI-powered study sets
          </motion.span>
          <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight">
            Turn your notes into <span className="text-gradient">study sessions</span> that stick.
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-6 text-lg text-muted max-w-xl">
            Upload lecture notes and StudyJit builds quizzes, flashcards, matching games and a study guide, then
            adapts to what you still need to learn.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
            <Link href={startHref} className="btn-primary text-lg px-7 py-3.5 group">
              Start studying
              <ArrowRight className="w-5 h-5 transition group-hover:translate-x-1" />
            </Link>
            <a href="#modes" className="btn-secondary text-lg px-7 py-3.5">
              See study modes
            </a>
          </motion.div>
          <motion.ul variants={fadeUp} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {["8 ways to study", "Explanations for every answer", "Works with PDFs & slides"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        {/* A preview: the owl with study cards floating around it */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-[26rem] sm:h-[30rem]"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute h-72 w-72 rounded-full bg-gradient-to-br from-brand/30 to-brand-2/30 blur-2xl" />
            <Image src="/images/logo-square.png" alt="" width={260} height={260} className="relative animate-float" priority />
          </div>
          <FloatCard className="top-4 left-0 sm:left-6" delay={0.3}>
            <p className="text-xs font-semibold text-muted mb-1">Flashcard</p>
            <p className="font-bold">Mitochondria</p>
            <p className="text-xs text-muted">Tap to flip ↻</p>
          </FloatCard>
          <FloatCard className="top-10 right-0 sm:right-4" delay={0.5}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">Correct!</p>
                <p className="text-xs text-muted">🔥 5 in a row</p>
              </div>
            </div>
          </FloatCard>
          <FloatCard className="bottom-6 left-2 sm:left-10" delay={0.7}>
            <p className="text-xs font-semibold text-muted mb-2">Mastery</p>
            <div className="w-44 h-2 rounded-full bg-surface-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-brand to-brand-2"
                initial={{ width: "10%" }}
                animate={{ width: "82%" }}
                transition={{ delay: 1, duration: 1.6, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted mt-1.5">18 of 22 terms mastered</p>
          </FloatCard>
          <FloatCard className="bottom-16 right-0 sm:right-8" delay={0.9}>
            <p className="text-xs font-semibold text-muted">Match</p>
            <p className="text-2xl font-extrabold tabular-nums text-gradient">0:24.6</p>
          </FloatCard>
        </motion.div>
      </main>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <SectionTitle eyebrow="How it works" title="From notes to mastery in three steps" />
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="card p-7"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white flex items-center justify-center">
                  <s.icon className="w-5 h-5" />
                </span>
                <span className="text-sm font-bold text-muted">Step {i + 1}</span>
              </div>
              <h3 className="text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-muted">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Study modes */}
      <section id="modes" className="mx-auto max-w-7xl px-6 pb-28 scroll-mt-10">
        <SectionTitle eyebrow="Study modes" title="More than a quiz: eight ways to learn" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {modes.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: (i % 4) * 0.08, duration: 0.45 }}
              className="card card-hover p-6"
            >
              <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${m.color} text-white flex items-center justify-center shadow-lg mb-4`}>
                <m.icon className="w-6 h-6" />
              </span>
              <h3 className="font-bold text-lg">{m.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{m.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-2 p-10 sm:p-14 text-center text-white"
        >
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
          <h2 className="relative text-3xl sm:text-4xl font-extrabold">Your next exam, sorted.</h2>
          <p className="relative mt-3 text-white/85 text-lg">Make your first study set in under a minute.</p>
          <Link
            href={startHref}
            className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-bold text-brand shadow-xl transition hover:scale-105 active:scale-95"
          >
            Get started free <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-stroke py-8 text-center text-sm text-muted">
        © {new Date().getFullYear()} StudyJit · Learn smarter with AI
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center mb-12"
    >
      <p className="text-sm font-bold uppercase tracking-widest text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">{title}</h2>
    </motion.div>
  );
}

function FloatCard({ children, className, delay }: { children: React.ReactNode; className: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className={`absolute ${className}`}
    >
      <div className="card px-4 py-3 animate-float" style={{ animationDelay: `${delay * 2}s` }}>
        {children}
      </div>
    </motion.div>
  );
}
