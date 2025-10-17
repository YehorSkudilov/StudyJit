"use client";

import { X, FilePlus, ArrowLeft } from "lucide-react";
import { useState } from "react";

type FileUploadPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload: (file: File) => void; // Function to handle file upload
};

export default function FileUploadPopup({
  isOpen,
  onClose,
  onFileUpload,
}: FileUploadPopupProps) {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [activeType, setActiveType] = useState<"upload" | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) setInputFile(file);
  };

  const handleSubmit = () => {
    if (inputFile) {
      onFileUpload(inputFile); // Upload the selected file
      setInputFile(null);
      setActiveType(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setInputFile(null);
    setActiveType(null);
    onClose();
  };

  const handleBack = () => {
    setInputFile(null);
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
            {activeType ? "Upload File" : "Upload New File"}
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
              onClick={() => setActiveType("upload")}
              className="flex items-center gap-2 justify-center p-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              <FilePlus className="w-5 h-5" /> Upload File
            </button>
          </div>
        )}

        {activeType === "upload" && (
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="*/*"
              onChange={handleFileChange}
              className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />

            {inputFile && (
              <div className="text-gray-600 dark:text-gray-300 mt-2">
                <strong>Selected File:</strong> {inputFile.name}
              </div>
            )}

            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
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
