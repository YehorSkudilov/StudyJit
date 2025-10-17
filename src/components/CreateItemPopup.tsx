"use client";

import { X, Folder, FileText, ArrowLeft } from "lucide-react";
import { useState } from "react";

type CreateItemPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateQuiz: (title: string) => void;
  onCreateFolder: (name: string) => void;
};

export default function CreateItemPopup({
  isOpen,
  onClose,
  onCreateQuiz,
  onCreateFolder,
}: CreateItemPopupProps) {
  const [activeType, setActiveType] = useState<"quiz" | "folder" | null>(null);
  const [inputValue, setInputValue] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (activeType === "quiz" && inputValue.trim() !== "") {
      onCreateQuiz(inputValue.trim());
    } else if (activeType === "folder" && inputValue.trim() !== "") {
      onCreateFolder(inputValue.trim());
    }
    setInputValue("");
    setActiveType(null);
    onClose();
  };

  const handleCancel = () => {
    setInputValue("");
    setActiveType(null);
    onClose();
  };

  const handleBack = () => {
    setInputValue("");
    setActiveType(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-lg flex flex-col gap-4">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <div className="w-16">
            {activeType && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center flex-1">
            {activeType
              ? activeType === "quiz"
                ? "New Quiz"
                : "New Folder"
              : "Create New Item"}
          </h2>

          {/* Close Button */}
          <div className="w-16 flex justify-end">
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!activeType && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setActiveType("quiz")}
              className="flex items-center gap-2 justify-center p-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              <FileText className="w-5 h-5" /> Create Quiz
            </button>

            <button
              onClick={() => setActiveType("folder")}
              className="flex items-center gap-2 justify-center p-3 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
            >
              <Folder className="w-5 h-5" /> Create Folder
            </button>
          </div>
        )}

        {activeType && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder={activeType === "quiz" ? "Enter Quiz Title" : "Enter Folder Name"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />

            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
            >
              {activeType === "quiz" ? "Create Quiz" : "Create Folder"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
