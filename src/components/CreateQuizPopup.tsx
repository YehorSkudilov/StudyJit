"use client";

import { X, BookPlus, AlertCircle } from "lucide-react";
import { useState } from "react";

type CreateQuizPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateQuiz: (quizName: string, description?: string) => Promise<void> | void;
};

export default function CreateQuizPopup({
  isOpen,
  onClose,
  onCreateQuiz,
}: CreateQuizPopupProps) {
  const [quizName, setQuizName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!quizName.trim()) {
      setError("Quiz name is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onCreateQuiz(quizName.trim(), description.trim());
      setQuizName("");
      setDescription("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create quiz.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    setQuizName("");
    setDescription("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-lg flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="w-16"></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex-1 text-center">
            New Quiz
          </h2>
          <div className="w-16 flex justify-end">
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className={`text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Input fields */}
        <input
          type="text"
          placeholder="Enter Quiz Title"
          value={quizName}
          onChange={(e) => setQuizName(e.target.value)}
          disabled={isSubmitting}
          className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 
                     dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"
        />

        <textarea
          placeholder="Enter Quiz Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
          className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 
                     dark:bg-gray-700 dark:text-gray-100 resize-none h-24 disabled:opacity-50"
        />

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-2 rounded flex justify-center items-center gap-2 text-white font-medium transition ${
            isSubmitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          <BookPlus className="w-5 h-5" />
          {isSubmitting ? "Creating..." : "Create Quiz"}
        </button>
      </div>
    </div>
  );
}
