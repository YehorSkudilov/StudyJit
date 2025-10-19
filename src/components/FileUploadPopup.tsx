"use client";

import { X, FilePlus, ArrowLeft, File, AlertCircle, Loader2, UploadCloud } from "lucide-react";
import { useState, DragEvent } from "react";

type FileUploadPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload: (file: File, onProgress?: (progress: number) => void) => Promise<void>;
};

export default function FileUploadPopup({
  isOpen,
  onClose,
  onFileUpload,
}: FileUploadPopupProps) {
  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [activeType, setActiveType] = useState<"upload" | null>(null);
  const [error, setError] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setInputFiles([]);
    setActiveType(null);
    setError("");
    setUploadProgress({});
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setInputFiles(files);
    setError("");
    setUploadProgress({});
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setInputFiles(files);
      setError("");
      setUploadProgress({});
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = async () => {
    if (inputFiles.length === 0) {
      setError("Please select at least one file.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      for (const file of inputFiles) {
        await onFileUpload(file, (progress) =>
          setUploadProgress((prev) => ({ ...prev, [file.name]: progress }))
        );
      }

      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    if (isUploading) return;
    reset();
    onClose();
  };

  const handleBack = () => {
    if (isUploading) return;
    reset();
  };

  return (
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5 max-h-[85vh]">
    {/* Header */}
    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
      <div className="w-16">
        {activeType && !isUploading && (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1 text-center">
        {activeType ? "Upload Files" : "New Upload"}
      </h2>

      <div className="w-16 flex justify-end">
        <button
          onClick={handleCancel}
          disabled={isUploading}
          className={`text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ${
            isUploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>

    {/* Main Upload Area */}
    {!activeType && (
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setActiveType("upload")}
          className="flex items-center gap-2 justify-center py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          <FilePlus className="w-5 h-5" /> Upload Files
        </button>
      </div>
    )}

    {activeType === "upload" && (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col gap-4 border-2 border-dashed rounded-xl p-5 transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-gray-700/30"
            : "border-gray-300 dark:border-gray-600"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-300">
          <UploadCloud className="w-8 h-8" />
          <p className="text-sm text-center">
            Drag & drop files here or{" "}
            <label
              htmlFor="fileInput"
              className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
            >
              browse
            </label>
          </p>
          <input
            id="fileInput"
            type="file"
            multiple
            accept="*/*"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </div>

        {/* Scrollable file list */}
        {inputFiles.length > 0 && (
          <div className="max-h-[45vh] overflow-y-auto flex flex-col gap-3 pr-1">
            {inputFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-start gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-inner break-words"
              >
                <File className="w-6 h-6 text-blue-500 flex-shrink-0" />
                <div className="flex flex-col overflow-hidden w-full">
                  <span className="text-gray-900 dark:text-gray-100 font-medium break-words whitespace-normal">
                    {file.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>

                  {isUploading && uploadProgress[file.name] !== undefined && (
                    <div className="mt-2 w-full">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2 transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress[file.name]}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {uploadProgress[file.name]}% uploaded
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
          disabled={inputFiles.length === 0 || isUploading}
          className={`w-full py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
            inputFiles.length > 0 && !isUploading
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-400 text-gray-200 cursor-not-allowed"
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            "Upload Files"
          )}
        </button>
      </div>
    )}
  </div>
</div>

  );
}
