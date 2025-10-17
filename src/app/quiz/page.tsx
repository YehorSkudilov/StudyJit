"use client";
import { useState } from "react";
import { BookOpen, Plus, FileText, Trash2, Edit2, Check, ChevronLeft } from "lucide-react";

export default function QuizPage() {
  const [allDocuments, setAllDocuments] = useState([
    "Chapter 1 Notes",
    "Chapter 2 Notes",
    "Chapter 3 Notes",
    "Appendix A",
  ]);

  const [quizName, setQuizName] = useState("Math 101 Quiz");
  const [description, setDescription] = useState("Basic algebra and arithmetic");
  const [editingDescription, setEditingDescription] = useState(false);
  const [quizStatus, setQuizStatus] = useState<boolean | null>(null); // true = generated, false = failed, null = never

  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");

  const deleteDocument = (doc: string) => {
    setAllDocuments(allDocuments.filter(d => d !== doc));
    setSelectedDocs(selectedDocs.filter(d => d !== doc));
  };

  const deleteQuiz = () => {
    alert("Delete quiz feature here");
  };

  const toggleEditDescription = () => {
    setEditingDescription(!editingDescription);
  };

  const saveDescription = () => {
    setEditingDescription(false);
  };

  const handleGenerateQuiz = () => {
    if (!prompt) {
      setQuizStatus(false);
      return;
    }
    setQuizStatus(true);
    alert("Quiz generated!");
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col px-6 sm:px-20 py-10 gap-8">
        <div className="relative p-8 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col gap-6 max-w-4xl w-full mx-auto">

        {/* Back Button Top-Left */}
        <button
            onClick={() => window.history.back()} // or router.push("/dashboard") if using Next.js
            className="absolute top-4 left-4 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white rounded-full transition-colors cursor-pointer z-10"
        >
            <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Delete Quiz Button Top-Right */}
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
            {quizName}
            </h1>
            {/* Status Badge under the title */}
            <div className="mt-1">{getStatusIndicator()}</div>
        </header>

        {/* Description with Edit Icon */}
        <div className="flex flex-col gap-2 relative">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2">
            Description
            <button
              onClick={editingDescription ? saveDescription : toggleEditDescription}
              className={`p-1 rounded-full transition-colors cursor-pointer 
                ${editingDescription ? "text-green-600 hover:bg-green-500 hover:text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white"}`}
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
              onClick={() => alert("Add more documents feature here")}
            >
              <Plus className="w-5 h-5 mb-1" />
              <span className="text-xs text-center">Add</span>
            </div>

            {allDocuments.map((doc, idx) => (
              <div
                key={idx}
                className="relative flex-shrink-0 flex flex-col items-center justify-center rounded-lg shadow transition-colors w-20 h-20
                  bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200
                  hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                onClick={() => alert(`Previewing: ${doc}`)}
              >
                <FileText className="w-5 h-5 mb-1" />
                <span className="text-xs text-center">{doc}</span>

                {/* Delete Icon */}
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

        {/* Prompt + Buttons */}
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
            Generate
        </button>
        <button
            className={`px-6 py-3 rounded flex-1 transition 
            ${quizStatus ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-400 text-gray-200 hover:bg-gray-400 cursor-not-allowed"}`}
            onClick={() => {
            if (quizStatus) {
                alert("Starting Quiz..."); // replace with real start logic
            } else {
                alert("Quiz is not generated or failed. Please generate first!");
            }
            }}
        >
            Start Quiz
        </button>
    </div>

        </div>

      </div>
    </div>
  );
}
