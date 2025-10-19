"use client";

import { X, FilePlus, ArrowLeft, File, AlertCircle, Trash2 } from "lucide-react";
import { useState } from "react";

type FileUploadPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload: (files: File[]) => void;
};

export default function FileUploadPopup({
  isOpen,
  onClose,
  onFileUpload,
}: FileUploadPopupProps) {
  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [activeType, setActiveType] = useState<"upload" | null>(null);
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setInputFiles((prev) => [...prev, ...files]);
    setError("");
    e.target.value = ""; // Reset input to allow selecting same file again
  };

  const handleRemoveFile = (index: number) => {
    setInputFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (inputFiles.length === 0) {
      setError("Please select at least one file before uploading.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      await onFileUpload(inputFiles);
      setInputFiles([]);
      setActiveType(null);
      onClose();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setInputFiles([]);
    setActiveType(null);
    setError("");
    onClose();
  };

  const handleBack = () => {
    setInputFiles([]);
    setActiveType(null);
    setError("");
  };

  const totalSize = inputFiles.reduce((sum, file) => sum + file.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="w-16">
            {activeType && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                disabled={uploading}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center flex-1">
            {activeType ? "Upload Files" : "Upload New Files"}
          </h2>

          <div className="w-16 flex justify-end">
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              disabled={uploading}
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
              <FilePlus className="w-5 h-5" /> Upload Files
            </button>
          </div>
        )}

        {activeType === "upload" && (
          <div className="flex flex-col gap-3">
            {/* File Input */}
            <label className="w-full px-4 py-8 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer transition text-center bg-gray-50 dark:bg-gray-700/50">
              <input
                type="file"
                multiple
                accept="*/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
              <FilePlus className="w-10 h-10 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                Click to select files
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                or drag and drop (multiple files supported)
              </p>
            </label>

            {/* File List */}
            {inputFiles.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>{inputFiles.length} file(s) selected</span>
                  <span>{formatSize(totalSize)}</span>
                </div>

                {inputFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-start gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-inner group"
                  >
                    <File className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 overflow-hidden min-w-0">
                      <p className="text-gray-900 dark:text-gray-100 font-medium break-words">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatSize(file.size)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition flex-shrink-0 opacity-0 group-hover:opacity-100"
                      disabled={uploading}
                      title="Remove file"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleSubmit}
              disabled={inputFiles.length === 0 || uploading}
              className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                inputFiles.length > 0 && !uploading
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-400 text-gray-200 cursor-not-allowed"
              }`}
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading {inputFiles.length} file(s)...
                </>
              ) : (
                <>
                  Upload {inputFiles.length > 0 ? `${inputFiles.length} File(s)` : "Files"}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}