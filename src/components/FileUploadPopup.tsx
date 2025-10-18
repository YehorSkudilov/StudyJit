"use client";

import { X, FilePlus, ArrowLeft, File, AlertCircle } from "lucide-react";
import { useState } from "react";

type FileUploadPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload: (file: File) => void;
};

export default function FileUploadPopup({
  isOpen,
  onClose,
  onFileUpload,
}: FileUploadPopupProps) {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [activeType, setActiveType] = useState<"upload" | null>(null);
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setInputFile(file);
    setError("");
  };

  const handleSubmit = () => {
    if (!inputFile) {
      setError("Please select a file before uploading.");
      return;
    }

    onFileUpload(inputFile);
    setInputFile(null);
    setActiveType(null);
    setError("");
    onClose();
  };

  const handleCancel = () => {
    setInputFile(null);
    setActiveType(null);
    setError("");
    onClose();
  };

  const handleBack = () => {
    setInputFile(null);
    setActiveType(null);
    setError("");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-lg flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
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

          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center flex-1">
            {activeType ? "Upload File" : "Upload New File"}
          </h2>

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
              onClick={() => setActiveType("upload")}
              className="flex items-center gap-2 justify-center p-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              <FilePlus className="w-5 h-5" /> Upload File
            </button>
          </div>
        )}

        {activeType === "upload" && (
          <div className="flex flex-col gap-3">
            <input
              type="file"
              accept="*/*"
              onChange={handleFileChange}
              className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />

            {inputFile && (
              <div className="flex items-start gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-inner break-words">
                <File className="w-6 h-6 text-blue-500 flex-shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-gray-900 dark:text-gray-100 font-medium break-words whitespace-normal">
                    {inputFile.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {(inputFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              className={`w-full py-2 rounded transition ${
                inputFile
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-400 text-gray-200 cursor-not-allowed"
              }`}
              disabled={!inputFile}
            >
              Upload File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
