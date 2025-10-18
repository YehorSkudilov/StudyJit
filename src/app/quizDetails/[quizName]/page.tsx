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

type GenerationStatus = "pending" | "success" | "failed" | null;

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
  const [generationStatus, setGenerationStatus] =
    useState<GenerationStatus>(null);

  const [originalDocuments, setOriginalDocuments] = useState<DocumentItem[]>([]);
  const [stagedDocuments, setStagedDocuments] = useState<DocumentItem[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [showFilePopup, setShowFilePopup] = useState(false);

  // ✅ Load quiz details
  useEffect(() => {
    const storedId = sessionStorage.getItem("selectedQuizId");
    if (!storedId) {
      setAlertMessage("⚠️ No quiz selected. Returning to dashboard...");
      setShowAlert(true);
      setTimeout(() => router.push("/dashboard"), 2000);
      return;
    }

    const id = Number(storedId);
    setQuizId(id);

   const fetchQuiz = async () => {
  try {
    const res = await fetch(`/api/db/getQuiz/${id}`);
    const data = await res.json();
    setQuizTitle(data.name);
    setDescription(data.description);
    setPrompt(data.prompt || "");
    setGenerationStatus(data.generation_status || null);
    setNumQuestions(data.num_questions || 10); // ✅ <-- added
  } catch {
    setAlertMessage("❌ Failed to load quiz details.");
    setShowAlert(true);
  }
};

    fetchQuiz();
  }, [router]);

  // ✅ Load linked files
  useEffect(() => {
    if (!quizId) return;
    const fetchDocuments = async () => {
      try {
        const res = await fetch(`/api/db/quizFiles/get/${quizId}`);
        const data = await res.json();
        setOriginalDocuments(data);
        setStagedDocuments(data);
      } catch {
        setAlertMessage("❌ Failed to load quiz files.");
        setShowAlert(true);
      }
    };
    fetchDocuments();
  }, [quizId]);

  // ✅ Local add/remove (no DB until save)
  const handleAddFile = (file: DocumentItem) => {
    setStagedDocuments((prev) => [...prev, file]);
  };
  const handleRemoveFile = (fileId: number) => {
    setStagedDocuments((prev) => prev.filter((f) => f.id !== fileId));
  };

  // ✅ Save & Generate (update DB + status only)
const handleSaveAndGenerate = async () => {
  if (!quizId) return;

  try {
    // 🧩 1. Update quiz basic info
    const updateRes = await fetch("/api/db/updateQuiz", {
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
      throw new Error("Failed to update quiz info.");
    }

    // ✅ Refresh to reflect latest name/description/numQuestions
    router.refresh();

    // 🧩 2. Sync added/removed files
    const added = stagedDocuments.filter(
      (f) => !originalDocuments.some((o) => o.id === f.id)
    );
    const removed = originalDocuments.filter(
      (o) => !stagedDocuments.some((f) => f.id === o.id)
    );

    for (const file of added) {
      await fetch("/api/db/quizFiles/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, fileId: file.id }),
      });
    }

    for (const file of removed) {
      await fetch("/api/db/quizFiles/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: quizId, file_id: file.id }),
      });
    }

    setOriginalDocuments(stagedDocuments);

    // 🟡 3. Set status to pending immediately
    setGenerationStatus("pending");
    await fetch("/api/db/quizStatus/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: quizId, status: "pending" }),
    });

    setAlertMessage("⏳ Quiz saved and generation started...");
    setShowAlert(true);

    // 🟢 4. Generate quiz
    const form = new FormData();
    form.append("message", prompt);
    form.append("quizName", quizTitle);
    form.append("description", description);
    form.append("quizId", String(quizId));
    form.append("numQuestions", String(numQuestions));

    console.log("🧠 Sending generation request to /api/ai/generateQuiz...");
    const res = await fetch("/api/ai/generateQuiz", { method: "POST", body: form });
    console.log("📩 Received response:", res.status);

    let data: any = null;
    try {
      data = await res.json();
      console.log("📊 Response:", data);
    } catch (err) {
      console.error("❌ JSON parse error:", err);
    }

    if (res.ok && data?.success) {
      console.log(`✅ Quiz #${quizId} generated successfully.`);
      setGenerationStatus("success");
      await fetch("/api/db/quizStatus/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quizId, status: "success" }),
      });
      setAlertMessage(`✅ Quiz "${quizTitle}" generated successfully!`);
    } else {
      console.error("❌ Quiz generation failed:", data);
      setGenerationStatus("failed");
      await fetch("/api/db/quizStatus/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quizId, status: "failed" }),
      });
      setAlertMessage("❌ Quiz generation failed.");
    }

    setShowAlert(true);

    // ✅ Refresh again to reflect final generation_status + num_questions
    setTimeout(() => {
      router.refresh();
    }, 800);
  } catch (err) {
    console.error("❌ Generation error:", err);
    setGenerationStatus("failed");
    await fetch("/api/db/quizStatus/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: quizId, status: "failed" }),
    });
    setAlertMessage("❌ Failed to save or generate quiz.");
    setShowAlert(true);
    setTimeout(() => router.refresh(), 800);
  }
};

  const getStatusIndicator = () => {
    switch (generationStatus) {
      case "pending":
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500 text-white">Pending</span>;
      case "success":
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500 text-white">Generated</span>;
      case "failed":
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500 text-white">Failed</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-300 text-gray-700">Never Generated</span>;
    }
  };

  return (
    <>
      {showAlert && <AlertPopup message={alertMessage} onClose={() => setShowAlert(false)} />}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col px-6 sm:px-20 py-10 gap-8">
        <div className="relative p-8 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col gap-6 max-w-4xl w-full mx-auto">
          {/* 🔙 Back */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Title + Status */}
          <header className="text-center">
            <div className="flex justify-center items-center gap-2 mb-1">
              <BookOpen className="w-6 h-6 text-blue-500" />
              {editingName ? (
                <input
                  type="text"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="text-3xl font-bold bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 border border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{quizTitle}</h1>
              )}
              <button
                onClick={() => setEditingName((prev) => !prev)}
                className={`p-1 rounded-full transition-colors ${
                  editingName
                    ? "text-green-600 hover:bg-green-500 hover:text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                {editingName ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-2">{getStatusIndicator()}</div>
          </header>

          {/* Description */}
          <section className="flex flex-col gap-2 relative">
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
                {editingDescription ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </h2>

            {editingDescription ? (
              <input
                type="text"
                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            ) : (
              <p className="text-gray-700 dark:text-gray-200 text-lg">
                {description || "No description available."}
              </p>
            )}
          </section>

          {/* Documents */}
          <section className="flex flex-col gap-2 mt-4">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Documents</h2>
            <div className="flex gap-2 overflow-x-auto py-2">
              <div
                className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-600 
                text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-500 transition w-20 h-20"
                onClick={() => setShowFilePopup(true)}
              >
                <Plus className="w-5 h-5 mb-1" />
                <span className="text-xs text-center">Add</span>
              </div>

              {stagedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="relative flex-shrink-0 flex flex-col items-center justify-center rounded-lg shadow transition-colors 
                    w-20 h-20 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                >
                  <FileText className="w-5 h-5 mb-1" />
                  <span className="text-xs text-center truncate w-full px-1">{doc.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(doc.id);
                    }}
                    className="absolute top-1 right-1 p-1 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Number of Questions Slider */}
          <section className="flex flex-col gap-2 mt-4">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
              Number of Questions
            </h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="50"
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 min-w-[3rem] text-center">
                {numQuestions}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Drag the slider to select between 1 and 50 questions
            </p>
          </section>

          {/* Prompt + Save */}
          <section className="flex flex-col gap-2 mt-4">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Prompt</h2>
            <textarea
              className="w-full p-4 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 
                text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt for this quiz..."
            />

            <div className="flex gap-3 mt-2">
              <button
                className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex-1"
                onClick={handleSaveAndGenerate}
              >
                Save & Generate
              </button>
              <button
                className={`px-6 py-3 rounded flex-1 transition ${
                  generationStatus === "success"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-400 text-gray-200 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (generationStatus === "success" && quizId) {
                    sessionStorage.setItem("selectedQuizId", String(quizId));
                    console.log("🚀 Navigating to quiz:", quizTitle);

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
        </div>
      </div>

      {/* 📁 Add File Popup */}
      <QuizAddFilePopup
        isOpen={showFilePopup}
        onClose={() => setShowFilePopup(false)}
        existingFileIds={stagedDocuments.map((d) => d.id)}
        onAddFile={handleAddFile}
      />
    </>
  );
}