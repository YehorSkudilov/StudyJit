"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookOpen, Plus, FileText, Trash2, Edit2, Check, ChevronLeft } from "lucide-react";
import AlertPopup from "@/components/AlertPopup";

export default function QuizDetailsPage() {
  const router = useRouter();
  const { quizName } = useParams();
  const decodedQuizName = decodeURIComponent(quizName as string);

  const [allDocuments, setAllDocuments] = useState([
    "Chapter 1 Notes",
    "Chapter 2 Notes",
    "Chapter 3 Notes",
    "Appendix A",
  ]);

  const [description, setDescription] = useState("Basic algebra and arithmetic");
  const [editingDescription, setEditingDescription] = useState(false);
  const [quizStatus, setQuizStatus] = useState<boolean | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");

  const [showAlert, setShowAlert] = useState(false); // ⬅️ state for popup
  const [alertMessage, setAlertMessage] = useState(""); // ⬅️ message to display

  const deleteDocument = (doc: string) => {
    setAllDocuments(allDocuments.filter((d) => d !== doc));
    setSelectedDocs(selectedDocs.filter((d) => d !== doc));
  };

  const deleteQuiz = () => {
    setAlertMessage(`Deleting quiz: ${decodedQuizName}`);
    setShowAlert(true);
  };

  const toggleEditDescription = () => setEditingDescription(!editingDescription);
  const saveDescription = () => setEditingDescription(false);

const handleGenerateQuiz = async () => {
  if (!prompt.trim()) {
    setQuizStatus(false);
    setAlertMessage("Please enter a prompt before generating.");
    setShowAlert(true);
    return;
  }

  try {
    setQuizStatus(null);
    setAlertMessage("Generating quiz... please wait ⏳");
    setShowAlert(true);

    const form = new FormData();
    form.append("message", prompt);

    const res = await fetch("/api/chatGPT", {
      method: "POST",
      body: form,
    });

    const data = await res.json();

    // 🧠 Add this line:
    console.log("📦 API Response:", data);

    if (data.questions) {
      localStorage.setItem(`quiz_${decodedQuizName}`, JSON.stringify(data.questions));
      setQuizStatus(true);
      setAlertMessage("✅ Quiz generated successfully!");
    } else {
      throw new Error("Invalid response format");
    }
  } catch (err) {
    console.error("❌ Error generating quiz:", err);
    setQuizStatus(false);
    setAlertMessage("❌ Failed to generate quiz. Try again.");
  } finally {
    setShowAlert(true);
  }
};



  const getStatusIndicator = () => {
    if (quizStatus === true) {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-500 text-white">Generated</span>;
    } else if (quizStatus === false) {
      return <span className="px-2 py-1 text-xs rounded-full bg-red-500 text-white">Failed</span>;
    } else {
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-300 text-gray-700">Never Generated</span>;
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      {/* Alert Popup */}
      {showAlert && (
        <AlertPopup
          message={alertMessage}
          onClose={() => setShowAlert(false)}
        />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col px-6 sm:px-20 py-10 gap-8">
        <div className="relative p-8 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col gap-6 max-w-4xl w-full mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white rounded-full transition-colors cursor-pointer z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Delete Quiz Button */}
          <button
            onClick={deleteQuiz}
            className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors cursor-pointer z-10"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Header */}
          <header className="w-full flex flex-col items-center justify-center relative mb-4">
            <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2 leading-tight">
              <BookOpen className="w-6 h-6" />
              {decodedQuizName}
            </h1>
            <div className="mt-1">{getStatusIndicator()}</div>
          </header>

          {/* Description */}
          <div className="flex flex-col gap-2 relative">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2">
              Description
              <button
                onClick={editingDescription ? saveDescription : toggleEditDescription}
                className={`p-1 rounded-full transition-colors cursor-pointer ${
                  editingDescription
                    ? "text-green-600 hover:bg-green-500 hover:text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {editingDescription ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </h2>

            {editingDescription ? (
              <input
                type="text"
                className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            ) : (
              <p className="text-gray-700 dark:text-gray-200 text-lg">{description}</p>
            )}
          </div>

          {/* Documents */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Documents</h2>
            <div className="flex gap-2 overflow-x-auto py-2">
              {/* Add Document Icon */}
              <div
                className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-500 transition w-20 h-20"
                onClick={() => {
                  setAlertMessage("📄 Add more documents feature coming soon!");
                  setShowAlert(true);
                }}
              >
                <Plus className="w-5 h-5 mb-1" />
                <span className="text-xs text-center">Add</span>
              </div>

              {allDocuments.map((doc, idx) => (
                <div
                  key={idx}
                  className="relative flex-shrink-0 flex flex-col items-center justify-center rounded-lg shadow transition-colors w-20 h-20 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                  onClick={() => {
                    setAlertMessage(`Previewing: ${doc}`);
                    setShowAlert(true);
                  }}
                >
                  <FileText className="w-5 h-5 mb-1" />
                  <span className="text-xs text-center">{doc}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDocument(doc);
                    }}
                    className="absolute top-1 right-1 p-1 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors cursor-pointer z-10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt Section */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">Prompt</h2>
            <textarea
              className="w-full p-4 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt for this quiz..."
            />

            <div className="flex gap-3 mt-2">
              <button
                className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex-1"
                onClick={handleGenerateQuiz}
              >
                Save & Generate
              </button>
              <button
                className={`px-6 py-3 rounded flex-1 transition ${
                  quizStatus
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-400 text-gray-200 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (quizStatus) {
                    router.push(`/quiz/${encodeURIComponent(decodedQuizName)}`);
                  } else {
                    setAlertMessage("Quiz not ready. Please generate it first!");
                    setShowAlert(true);
                  }
                }}
              >
                Start Quiz
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
