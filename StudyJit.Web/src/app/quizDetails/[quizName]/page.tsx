"use client";
import { apiFetch } from "@/lib/api";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  Edit2,
  FileText,
  Loader2,
  Lock,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import AlertPopup from "@/components/AlertPopup";
import QuizAddFilePopup from "@/components/QuizAddFilePopup";
import ScoreRing from "@/components/ui/ScoreRing";
import { loadQuiz, type StudyQuiz } from "@/lib/study";
import { modes, studyHref } from "@/lib/modes";

type GenerationStatus = "never_generated" | "queued" | "pending" | "success" | "failed" | null;

interface DocumentItem {
  id: number;
  name: string;
  size?: number;
  file_path?: string;
}

/** A study set: its study modes once generated, and its setup (files, size, focus) for generating it. */
export default function QuizDetailsPage() {
  const router = useRouter();

  const [quizId, setQuizId] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<StudyQuiz | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [numQuestions, setNumQuestions] = useState<number>(15);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [queueNumber, setQueueNumber] = useState<number | null>(null);
  const [tab, setTab] = useState<"study" | "setup">("study");

  const [originalDocuments, setOriginalDocuments] = useState<DocumentItem[]>([]);
  const [stagedDocuments, setStagedDocuments] = useState<DocumentItem[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showFilePopup, setShowFilePopup] = useState(false);
  const [saving, setSaving] = useState(false);

  const generating = generationStatus === "queued" || generationStatus === "pending";

  /* ---------------------- Load ---------------------- */
  const refresh = useCallback(async (id: number, chooseTab = false) => {
    const res = await apiFetch(`/api/items/quizzes/get/${id}`);
    if (!res.ok) throw new Error("Failed to load quiz");
    const data = await res.json();
    setQuizTitle(data.name);
    setDescription(data.description ?? "");
    setPrompt(data.prompt || "");
    setGenerationStatus(data.generation_status || null);
    setNumQuestions(data.num_questions || 15);
    setLastScore(data.last_score ?? null);
    setQueueNumber(data.queue_number ?? null);
    setQuiz(await loadQuiz(id));
    if (chooseTab) setTab(data.questions?.length ? "study" : "setup");
  }, []);

  useEffect(() => {
    const storedId = sessionStorage.getItem("selectedQuizId");
    if (!storedId) {
      router.push("/learningSpace");
      return;
    }
    const id = Number(storedId);
    setQuizId(id);
    refresh(id, true).catch(() => setAlertMessage("Couldn't load this study set."));
  }, [router, refresh]);

  useEffect(() => {
    if (!quizId) return;
    apiFetch(`/api/items/quizzes/files/get/${quizId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: DocumentItem[]) => {
        setOriginalDocuments(data);
        setStagedDocuments(data);
      })
      .catch(() => setAlertMessage("Couldn't load this set's files."));
  }, [quizId]);

  /* ---------------------- Poll while generating ---------------------- */
  useEffect(() => {
    if (!quizId || !generating) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/items/quizzes/get/${quizId}`);
        if (!res.ok) return;
        const data = await res.json();
        setQueueNumber(data.queue_number ?? null);
        if (data.generation_status !== generationStatus) {
          setGenerationStatus(data.generation_status);
          if (data.generation_status === "success") {
            await refresh(quizId);
            setTab("study");
          }
        }
      } catch {
        // Try again on the next tick.
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [quizId, generating, generationStatus, refresh]);

  /* ---------------------- Save ---------------------- */
  const saveInfo = async (fields: Record<string, unknown>) => {
    if (!quizId) return;
    const res = await apiFetch("/api/items/quizzes/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: quizId, ...fields }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Couldn't save.");
  };

  const handleSaveAndGenerate = async () => {
    if (!quizId) return;
    if (stagedDocuments.length === 0 && !prompt.trim()) {
      setAlertMessage("Add at least one file, or describe the topic under “Focus”, so the AI knows what to write about.");
      return;
    }
    setSaving(true);
    try {
      await saveInfo({ name: quizTitle.trim(), description, prompt, numQuestions });

      const added = stagedDocuments.filter((f) => !originalDocuments.some((o) => o.id === f.id));
      const removed = originalDocuments.filter((o) => !stagedDocuments.some((f) => f.id === o.id));
      for (const file of added) {
        await apiFetch("/api/items/quizzes/files/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId, fileId: file.id }),
        });
      }
      for (const file of removed) {
        await apiFetch("/api/items/quizzes/files/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quiz_id: quizId, file_id: file.id }),
        });
      }
      setOriginalDocuments(stagedDocuments);

      const form = new FormData();
      form.append("quizId", String(quizId));
      const res = await apiFetch("/api/ai/generateQuiz", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setGenerationStatus(data.status === "queued" ? "queued" : "pending");
        setQueueNumber(data.queueNumber || null);
      } else {
        setAlertMessage(data?.error || "Generation couldn't start. Please try again.");
      }
    } catch (err) {
      setAlertMessage((err as Error).message || "Couldn't save or generate. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveTitle = async () => {
    setEditingName(false);
    if (quizTitle.trim()) await saveInfo({ name: quizTitle.trim() }).catch((e) => setAlertMessage(e.message));
  };

  const saveDescription = async () => {
    setEditingDescription(false);
    await saveInfo({ description }).catch((e) => setAlertMessage(e.message));
  };

  const hasQuestions = (quiz?.questions.length ?? 0) > 0;

  /* ---------------------- Render ---------------------- */
  return (
    <div className="page">
      {alertMessage && <AlertPopup message={alertMessage} onClose={() => setAlertMessage(null)} />}

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <button onClick={() => router.push("/learningSpace")} className="btn-ghost -ml-3 mb-4 px-3 py-1.5 text-sm">
          <ChevronLeft className="w-4 h-4" /> Study sets
        </button>

        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden card p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-brand/20 to-brand-2/20 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <StatusChip status={generationStatus} queueNumber={queueNumber} count={quiz?.questions.length ?? 0} />
                {quiz && quiz.terms.length > 0 && <span className="chip bg-surface-2 text-muted">{quiz.terms.length} key terms</span>}
              </div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                    className="input text-2xl font-extrabold py-1.5"
                    autoFocus
                  />
                  <button onClick={saveTitle} className="icon-btn text-emerald-500">
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <h1 className="group flex items-center gap-2 text-3xl sm:text-4xl font-extrabold tracking-tight">
                  <span className="truncate">{quizTitle || "…"}</span>
                  <button onClick={() => setEditingName(true)} className="icon-btn w-8 h-8 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Rename">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </h1>
              )}
              {editingDescription ? (
                <div className="mt-3 flex items-start gap-2">
                  <textarea className="input text-sm" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
                  <button onClick={saveDescription} className="icon-btn text-emerald-500">
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <p className="group mt-2 text-muted flex items-start gap-2">
                  <span>{description || "No description"}</span>
                  <button onClick={() => setEditingDescription(true)} className="icon-btn w-7 h-7 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Edit description">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </p>
              )}
            </div>
            {lastScore != null && (
              <div className="flex flex-col items-center">
                <ScoreRing percent={Number(lastScore)} size={110} stroke={10} />
                <span className="mt-1 text-xs font-semibold text-muted">Last score</span>
              </div>
            )}
          </div>
        </motion.section>

        {/* Tabs */}
        <div className="mt-8 mb-6 inline-flex rounded-full bg-surface-2 p-1">
          {(
            [
              ["study", "Study", BookOpen],
              ["setup", "Setup & generate", Settings2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition ${
                tab === key ? "text-brand" : "text-muted hover:text-foreground"
              }`}
            >
              {tab === key && (
                <motion.span layoutId="details-tab" className="absolute inset-0 rounded-full bg-surface shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <Icon className="relative w-4 h-4" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "study" ? (
            <motion.section key="study" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              {!hasQuestions && (
                <div className="card p-6 mb-6 flex flex-col sm:flex-row items-center gap-4 border-dashed">
                  <span className="w-12 h-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center">
                    {generating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />}
                  </span>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="font-bold">{generating ? "The AI is building your study set…" : "Nothing to study yet"}</p>
                    <p className="text-sm text-muted">
                      {generating ? "This usually takes under a minute. The modes unlock when it's done." : "Add your files and generate to unlock the study modes."}
                    </p>
                  </div>
                  {!generating && (
                    <button onClick={() => setTab("setup")} className="btn-primary">
                      Set it up
                    </button>
                  )}
                </div>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {modes.map((m, i) => {
                  const blocked = quiz ? m.unavailable(quiz) : "Loading";
                  return (
                    <motion.button
                      key={m.mode}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      disabled={!!blocked}
                      onClick={() => quizId && router.push(studyHref(quizId, m.mode))}
                      className={`group card text-left p-5 flex flex-col gap-3 transition ${
                        blocked ? "opacity-55 cursor-not-allowed" : "card-hover"
                      }`}
                    >
                      <span
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${m.gradient} text-white flex items-center justify-center shadow-md transition ${
                          blocked ? "grayscale" : "group-hover:scale-110 group-hover:-rotate-3"
                        }`}
                      >
                        <m.icon className="w-6 h-6" />
                      </span>
                      <div>
                        <p className="font-bold text-lg">{m.title}</p>
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
            </motion.section>
          ) : (
            <motion.section
              key="setup"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="grid lg:grid-cols-[1fr_20rem] gap-6 items-start"
            >
              <div className="flex flex-col gap-6">
                {/* Files */}
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-bold text-lg">Source files</h2>
                      <p className="text-sm text-muted">PDFs, slides, documents, images or text the AI reads.</p>
                    </div>
                    <button onClick={() => setShowFilePopup(true)} className="btn-secondary px-4 py-2 text-sm">
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                  {stagedDocuments.length === 0 ? (
                    <button
                      onClick={() => setShowFilePopup(true)}
                      className="w-full rounded-2xl border-2 border-dashed border-stroke py-10 text-muted hover:border-brand/50 hover:text-brand transition flex flex-col items-center gap-2"
                    >
                      <FileText className="w-8 h-8" />
                      <span className="font-semibold">Add files from your library</span>
                    </button>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      <AnimatePresence initial={false}>
                        {stagedDocuments.map((doc) => (
                          <motion.li
                            key={doc.id}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10, height: 0 }}
                            className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3"
                          >
                            <FileText className="w-5 h-5 text-brand flex-shrink-0" />
                            <span className="flex-1 truncate font-medium" title={doc.name}>
                              {doc.name}
                            </span>
                            <button
                              onClick={() => setStagedDocuments((prev) => prev.filter((f) => f.id !== doc.id))}
                              className="icon-btn w-8 h-8 hover:text-red-500 hover:bg-red-500/10"
                              title="Remove from this set"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>

                {/* Focus */}
                <div className="card p-6">
                  <h2 className="font-bold text-lg">Focus</h2>
                  <p className="text-sm text-muted mb-3">
                    Optional. Tell the AI what to concentrate on, or describe a topic if you have no files.
                  </p>
                  <textarea
                    className="input"
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Focus on chapters 3–4, especially the Krebs cycle. Make questions exam-style."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Exam-style questions", "Focus on definitions", "Include calculations", "Harder questions"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setPrompt((p) => (p.trim() ? `${p.trim()} ${s}.` : `${s}.`))}
                        className="chip bg-surface-2 text-muted hover:bg-brand-soft hover:text-brand transition"
                      >
                        <Plus className="w-3 h-3" /> {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate */}
              <div className="card p-6 lg:sticky lg:top-24">
                <h2 className="font-bold text-lg">Questions</h2>
                <div className="mt-3 flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    className="flex-1 accent-[var(--brand)]"
                    disabled={generating}
                  />
                  <span className="w-10 text-center text-2xl font-extrabold text-brand tabular-nums">{numQuestions}</span>
                </div>
                <ul className="mt-5 flex flex-col gap-2 text-sm text-muted">
                  {["Questions with explanations", "Key terms for flashcards & match", "A study guide summary"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand" /> {t}
                    </li>
                  ))}
                </ul>
                <button onClick={handleSaveAndGenerate} disabled={generating || saving} className="btn-primary w-full mt-6 py-3">
                  {generating || saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                  {saving
                    ? "Saving…"
                    : generationStatus === "queued"
                    ? `Queued${queueNumber ? ` (#${queueNumber})` : ""}…`
                    : generationStatus === "pending"
                    ? "Generating…"
                    : hasQuestions
                    ? "Regenerate"
                    : "Generate study set"}
                </button>
                {hasQuestions && !generating && (
                  <p className="mt-2 text-xs text-muted text-center">Regenerating replaces the current questions and terms.</p>
                )}
                {generating && <GeneratingBar />}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <QuizAddFilePopup
        isOpen={showFilePopup}
        onClose={() => setShowFilePopup(false)}
        existingFileIds={stagedDocuments.map((d) => d.id)}
        onAddFiles={(files: DocumentItem[]) => setStagedDocuments((prev) => [...prev, ...files])}
      />
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
      <X className="w-3 h-3" /> Not generated
    </span>
  );
}

function GeneratingBar() {
  return (
    <div className="mt-4 h-2 rounded-full bg-surface-2 overflow-hidden">
      <motion.div
        className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand to-brand-2"
        animate={{ x: ["-100%", "300%"] }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
      />
    </div>
  );
}
