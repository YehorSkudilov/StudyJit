"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

type CreateQuizPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (quizId: number) => void; // optional callback after success
};

export default function CreateQuizPopup({ isOpen, onClose, onCreated }: CreateQuizPopupProps) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleCreate = async () => {
    setError("");
    if (!title.trim()) {
      setError("Quiz name is required");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/db/createQuiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: title.trim(), // ✅ match backend expectation
          description: "",
          prompt: "",
          numQuestions: 10,
        }),
      });

      const data = await res.json().catch(() => null);
      setLoading(false);

      if (!res.ok) {
        setError(data?.error || "Failed to create quiz");
        return;
      }

      console.log("✅ Quiz created:", data);
      onCreated?.(data.quizId);
      setTitle("");
      onClose();
    } catch (err: any) {
      console.error("❌ Error creating quiz:", err);
      setError("Unexpected error, please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-lg relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Create New Quiz
        </h2>

        <input
          type="text"
          placeholder="Quiz title"
          value={title}
          disabled={loading}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 mb-3 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
        />

        {error && (
          <p className="text-red-600 text-sm mb-3">{error}</p>
        )}

        <button
          onClick={handleCreate}
          disabled={loading}
          className={`w-full py-2 rounded text-white transition ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Creating..." : "Create Quiz"}
        </button>
      </div>
    </div>
  );
}
