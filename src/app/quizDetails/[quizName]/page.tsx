"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  BookOpen,
  Plus,
  FileText,
  Trash2,
  Edit2,
  Check,
  ChevronLeft,
} from "lucide-react";
import AlertPopup from "@/components/AlertPopup";
import QuizAddFilePopup from "@/components/QuizAddFilePopup";

type GenerationStatus = "queued" | "pending" | "success" | "failed" | null;

interface DocumentItem {
  id: number;
  name: string;
  size?: number;
  file_path?: string;
}

export default function QuizDetailsPage() {
  const router = useRouter();
  const { quizName } = useParams();

  const [quizId, setQuizId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [queueNumber, setQueueNumber] = useState<number | null>(null);

  const [originalDocuments, setOriginalDocuments] = useState<DocumentItem[]>([]);
  const [stagedDocuments, setStagedDocuments] = useState<DocumentItem[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [showFilePopup, setShowFilePopup] = useState(false);

  /* ---------------------- Load Quiz Details ---------------------- */
  useEffect(() => {
    const storedId = sessionStorage.getItem("selectedQuizId");
    if (!storedId) {
      setAlertMessage("⚠️ No quiz selected. Returning to learningSpace...");
      setShowAlert(true);
      setTimeout(() => router.push("/learningSpace"), 2000);
      return;
    }

    const id = Number(storedId);
    setQuizId(id);

    const fetchQuiz = async () => {
      try {
        const res = await fetch(`/api/items/quizzes/get/${id}`);
        if (!res.ok) throw new Error("Failed to load quiz");
        const data = await res.json();
        setQuizTitle(data.name);
        setDescription(data.description);
        setPrompt(data.prompt || "");
        setGenerationStatus(data.generation_status || null);
        setNumQuestions(data.num_questions || 10);
        setLastScore(data.last_score ?? null);
        setQueueNumber(data.queue_number ?? null);
      } catch (err) {
        console.error("❌ Failed to load quiz:", err);
        setAlertMessage("❌ Failed to load quiz details.");
        setShowAlert(true);
      }
    };

    fetchQuiz();
  }, [router]);

  /* ---------------------- Load Linked Files ---------------------- */
  useEffect(() => {
    if (!quizId) return;
    const fetchDocuments = async () => {
      try {
        const res = await fetch(`/api/items/quizzes/files/get/${quizId}`);
        if (!res.ok) throw new Error("Failed to load quiz files");
        const data = await res.json();
        setOriginalDocuments(data);
        setStagedDocuments(data);
      } catch (err) {
        console.error("❌ Failed to load quiz files:", err);
        setAlertMessage("❌ Failed to load quiz files.");
        setShowAlert(true);
      }
    };
    fetchDocuments();
  }, [quizId]);

  /* ---------------------- File Management ---------------------- */
  const handleAddFiles = (files: DocumentItem[]) => {
    setStagedDocuments((prev) => [...prev, ...files]);
  };
  const handleRemoveFile = (fileId: number) => {
    setStagedDocuments((prev) => prev.filter((f) => f.id !== fileId));
  };

  /* ---------------------- Save & Generate ---------------------- */
  const handleSaveAndGenerate = async () => {
    if (!quizId) return;

    try {
      console.log("💾 Saving quiz info and preparing generation...");
      const updateRes = await fetch("/api/items/quizzes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quizId,
          name: quizTitle.trim(),
          description,
          prompt,
          numQuestions,
        }),
      });

      if (!updateRes.ok) {
        const text = await updateRes.text();
        console.error("❌ Failed to update quiz info:", text);
        throw new Error("Failed to update quiz info.");
      }

      router.refresh();

      // sync files
      const added = stagedDocuments.filter(
        (f) => !originalDocuments.some((o) => o.id === f.id)
      );
      const removed = originalDocuments.filter(
        (o) => !stagedDocuments.some((f) => f.id === o.id)
      );

      for (const file of added) {
        await fetch("/api/items/quizzes/files/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId, fileId: file.id }),
        });
      }
      for (const file of removed) {
        await fetch("/api/items/quizzes/files/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quiz_id: quizId, file_id: file.id }),
        });
      }

      setOriginalDocuments(stagedDocuments);

      const form = new FormData();
      form.append("message", prompt);
      form.append("quizName", quizTitle);
      form.append("description", description);
      form.append("quizId", String(quizId));
      form.append("numQuestions", String(numQuestions));

      console.log("🚀 Requesting quiz generation...");
      const res = await fetch("/api/ai/generateQuiz", {
        method: "POST",
        body: form,
      });

      const rawText = await res.text();
      console.log("📩 Raw response from /api/ai/generateQuiz:", rawText);

      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.warn("⚠️ Response was not valid JSON.");
      }

      // 🧠 Properly handle status transitions
      if (res.ok && data?.status === "queued") {
        console.log("🕒 Quiz queued for generation:", data);
        setGenerationStatus("queued");
        setQueueNumber(data?.queueNumber ?? null);

        await fetch("/api/items/quizzes/status/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: quizId, status: "queued" }),
        });
      } else if (res.ok && data?.success === true) {
        console.log("✅ Quiz generation started immediately:", data);
        setGenerationStatus("pending");
        setQueueNumber(null);

        await fetch("/api/items/quizzes/status/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: quizId, status: "pending" }),
        });
      } else {
        console.error("❌ Quiz generation failed to start:", data || rawText);
        setGenerationStatus("failed");
        setQueueNumber(null);

        await fetch("/api/items/quizzes/status/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: quizId, status: "failed" }),
        });

        setAlertMessage("❌ Quiz generation failed to start. Please try again.");
        setShowAlert(true);
      }

      setTimeout(() => router.refresh(), 1500);
    } catch (err: any) {
      console.error("💥 Uncaught error during quiz generation:", err);
      setGenerationStatus("failed");
      setQueueNumber(null);
      setAlertMessage("❌ Failed to save or generate quiz. See console for details.");
      setShowAlert(true);
      setTimeout(() => router.refresh(), 1500);
    }
  };

  /* ---------------------- Status Indicator ---------------------- */
  const getStatusIndicator = () => {
    switch (generationStatus) {
      case "queued":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-blue-500 text-white">
            Queued {queueNumber ? `(#${queueNumber})` : ""}
          </span>
        );
      case "pending":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-yellow-500 text-white">
            Processing
          </span>
        );
      case "success":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-green-500 text-white">
            Generated
          </span>
        );
      case "failed":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-red-500 text-white">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-300 text-gray-700">
            Never Generated
          </span>
        );
    }
  };

  /* ---------------------- 🔁 Poll Quiz Status ---------------------- */
  useEffect(() => {
    if (!quizId) return;
    // Only poll if status isn't final
    if (generationStatus === "success" || generationStatus === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/items/quizzes/get/${quizId}`);
        if (res.ok) {
          const data = await res.json();
          if (
            data.generation_status !== generationStatus ||
            data.queue_number !== queueNumber
          ) {
            console.log("🔄 Updated status or queue number:", {
              status: data.generation_status,
              queue_number: data.queue_number,
            });
            setGenerationStatus(data.generation_status);
            setQueueNumber(data.queue_number ?? null);
          }
        }
      } catch (err) {
        console.warn("⚠️ Failed to poll quiz status:", err);
      }
    }, 4000); // check every 4s

    return () => clearInterval(interval);
  }, [quizId, generationStatus, queueNumber]);

  /* ---------------------- Render ---------------------- */
  return (
    <>
      {showAlert && (
        <AlertPopup message={alertMessage} onClose={() => setShowAlert(false)} />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col px-3 sm:px-8 md:px-20 py-6 sm:py-10 gap-6">
        <div className="relative p-4 sm:p-8 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col gap-6 max-w-4xl w-full mx-auto">
          <button
            onClick={() => router.push("/learningSpace")}
            className="absolute top-6 left-3 sm:top-7 sm:left-4 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Title + Status + Score */}
          <header className="text-center mt-2 sm:mt-0">
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                {editingName ? (
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    className="text-2xl sm:text-3xl font-bold bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 border border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <h1 className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 truncate max-w-[85vw]">
                    {quizTitle}
                  </h1>
                )}
                <button
                  onClick={() => setEditingName((prev) => !prev)}
                  className={`p-1 rounded-full transition-colors ${
                    editingName
                      ? "text-green-600 hover:bg-green-500 hover:text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {editingName ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Edit2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* ✅ Status + Last Score */}
              <div className="mt-1 flex flex-col items-center gap-1">
                {getStatusIndicator()}
                {lastScore !== null ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last Score:{" "}
                    <span
                      className={`font-semibold ${
                        lastScore >= 80
                          ? "text-green-600"
                          : lastScore >= 50
                          ? "text-yellow-500"
                          : "text-red-500"
                      }`}
                    >
                      {lastScore}%
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                    No previous attempts
                  </p>
                )}
              </div>
            </div>
          </header>

          {/* Description Section */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2">
              Description
              <button
                onClick={() => setEditingDescription((prev) => !prev)}
                className={`p-1 rounded-full transition-colors ${
                  editingDescription
                    ? "text-green-600 hover:bg-green-500 hover:text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                {editingDescription ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Edit2 className="w-4 h-4" />
                )}
              </button>
            </h2>
            {editingDescription ? (
              <textarea
                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm sm:text-base"
                value={description}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            ) : (
              <p className="text-gray-700 dark:text-gray-200 text-base sm:text-lg break-words">
                {description || "No description available."}
              </p>
            )}
          </section>

          {/* Documents */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
              Documents
            </h2>
            <div className="flex gap-2 overflow-x-auto py-1">
              <div
                className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-500 transition w-16 h-16 sm:w-20 sm:h-20"
                onClick={() => setShowFilePopup(true)}
              >
                <Plus className="w-5 h-5 mb-1" />
                <span className="text-xs text-center">Add</span>
              </div>

              {stagedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="relative flex-shrink-0 flex flex-col items-center justify-center rounded-lg shadow transition-colors w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <FileText className="w-5 h-5 mb-1" />
                  <span
                    className="text-[10px] sm:text-xs text-center truncate w-full px-1"
                    title={doc.name}
                  >
                    {doc.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(doc.id);
                    }}
                    className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 p-1 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Number of Questions */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
              Number of Questions
            </h2>
            <div className="flex items-center gap-3 sm:gap-4">
              <input
                type="range"
                min="1"
                max="50"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 min-w-[3rem] text-center">
                {numQuestions}
              </span>
            </div>
          </section>

          {/* Prompt + Buttons */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
              Prompt
            </h2>
            <textarea
              className="w-full p-3 sm:p-4 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-blue-500"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt for this quiz..."
            />

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-1">
              <button
                className="px-5 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex-1 text-sm sm:text-base"
                onClick={handleSaveAndGenerate}
              >
                Save & Generate
              </button>
              <button
                className={`px-5 py-3 rounded flex-1 text-sm sm:text-base transition ${
                  generationStatus === "success"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-400 text-gray-200 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (generationStatus === "success" && quizId) {
                    sessionStorage.setItem("selectedQuizId", String(quizId));
                    router.push(`/quiz/${encodeURIComponent(quizTitle)}`);
                  } else {
                    setAlertMessage("Quiz not ready. Please generate it first!");
                    setShowAlert(true);
                  }
                }}
              >
                Start Quiz
              </button>
            </div>
          </section>

          {/* File Popup */}
          <QuizAddFilePopup
            isOpen={showFilePopup}
            onClose={() => setShowFilePopup(false)}
            existingFileIds={stagedDocuments.map((d) => d.id)}
            onAddFiles={handleAddFiles}
          />
        </div>
      </div>
    </>
  );
}
