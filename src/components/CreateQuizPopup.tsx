import React, { useState } from "react";
import { X } from "lucide-react";

type CreateQuizPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
};

export default function CreateQuizPopup({ isOpen, onClose, onCreate }: CreateQuizPopupProps) {
  const [title, setTitle] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-lg relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Create New Quiz</h2>
        <input
          type="text"
          placeholder="Quiz title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 mb-4 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
        />
        <button
          onClick={() => {
            onCreate(title);
            setTitle("");
          }}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          Create Quiz
        </button>
      </div>
    </div>
  );
}
