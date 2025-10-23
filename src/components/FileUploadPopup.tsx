"use client";

import {
  X,
  File,
  Link2,
  AlertCircle,
  Loader2,
  UploadCloud,
  Trash2,
  Youtube,
} from "lucide-react";
import { useState, DragEvent } from "react";

type UploadItem =
  | { type: "file"; file: File }
  | { type: "youtube"; url: string };

type FileUploadPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  activeFolderId?: string | null;
  onFileUpload: (file: File, onProgress?: (progress: number) => void) => Promise<void>;
  onYouTubeUpload: (url: string, onProgress?: (progress: number) => void) => Promise<void>; // ✅ FIXED: Required + progress callback
};

export default function FileUploadPopup({
  isOpen,
  onClose,
  activeFolderId,
  onFileUpload,
  onYouTubeUpload,
}: FileUploadPopupProps) {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");

  if (!isOpen) return null;

  const reset = () => {
    setUploadItems([]);
    setYoutubeUrl("");
    setUploadProgress({});
    setError("");
  };

  /* ---------------- File Handling ---------------- */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const newItems = files.map((file) => ({ type: "file" as const, file }));
    setUploadItems((prev) => [...prev, ...newItems]);
    setError("");
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const newItems = files.map((file) => ({ type: "file" as const, file }));
    setUploadItems((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveItem = (name: string) => {
    setUploadItems((prev) =>
      prev.filter((item) =>
        item.type === "file" ? item.file.name !== name : item.url !== name
      )
    );
    setUploadProgress((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  };

  /* ---------------- YouTube Handling ---------------- */
  const handleAddYoutube = () => {
    const trimmed = youtubeUrl.trim();
    if (!trimmed) return setError("Please enter a YouTube URL.");

    const youtubeRegex =
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!youtubeRegex.test(trimmed)) {
      return setError("Invalid YouTube link.");
    }

    const alreadyExists = uploadItems.some(
      (i) => i.type === "youtube" && i.url === trimmed
    );
    if (alreadyExists) return setError("This YouTube link is already added.");

    setUploadItems((prev) => [...prev, { type: "youtube", url: trimmed }]);
    setYoutubeUrl("");
    setError("");
  };

  /* ---------------- Upload Submit ---------------- */
  const handleUploadSubmit = async () => {
    if (uploadItems.length === 0) {
      setError("Please add files or YouTube links first.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      for (const item of uploadItems) {
        if (item.type === "file") {
          await onFileUpload(item.file, (progress) =>
            setUploadProgress((prev) => ({
              ...prev,
              [item.file.name]: progress,
            }))
          );
        } else if (item.type === "youtube") {
          const nameKey = `YT: ${item.url}`;
          setUploadProgress((prev) => ({ ...prev, [nameKey]: 0 }));

          // ✅ FIXED: Use parent handler with progress callback - NO EventSource!
          await onYouTubeUpload(item.url, (progress) => {
            setUploadProgress((prev) => ({ ...prev, [nameKey]: progress }));
          });
        }
      }

      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    if (isUploading) return;
    reset();
    onClose();
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl 
                   w-[90vw] sm:w-full sm:max-w-md 
                   max-h-[85vh] overflow-y-auto 
                   p-5 sm:p-6 flex flex-col gap-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="w-10" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1 text-center">
            Upload Files or YouTube Links
          </h2>
          <button
            onClick={handleCancel}
            disabled={isUploading}
            className={`text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition ${
              isUploading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Drop Area */}
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
          <div className="flex flex-col items-center text-gray-500 dark:text-gray-300 text-center gap-2">
            <UploadCloud className="w-8 h-8" />
            <p className="text-sm">
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
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
          </div>

          {uploadItems.length > 0 && (
            <div className="max-h-[40vh] overflow-y-auto flex flex-col gap-3">
              {uploadItems.map((item, idx) => {
                const key =
                  item.type === "file" ? item.file.name : `YT: ${item.url}`;
                const progress = uploadProgress[key];
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-inner"
                  >
                    {item.type === "file" ? (
                      <File className="w-6 h-6 text-blue-500" />
                    ) : (
                      <Youtube className="w-6 h-6 text-red-600" />
                    )}
                    <div className="flex flex-col w-full">
                      <span className="text-gray-900 dark:text-gray-100 font-medium break-all">
                        {item.type === "file"
                          ? item.file.name
                          : item.url.replace(/^https?:\/\//, "")}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {item.type === "file"
                          ? `${(item.file.size / 1024 / 1024).toFixed(2)} MB`
                          : "YouTube video"}
                      </span>
                      {isUploading && progress !== undefined && (
                        <>
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-2 transition-all duration-300 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {progress.toFixed(1)}% uploaded
                          </p>
                        </>
                      )}
                    </div>
                    {!isUploading && (
                      <button
                        onClick={() => handleRemoveItem(key)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add YouTube Link */}
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-gray-500" />
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            disabled={isUploading}
            className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={handleAddYoutube}
            disabled={isUploading || !youtubeUrl.trim()}
            className={`px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2 transition ${
              isUploading || !youtubeUrl.trim()
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            <Youtube className="w-4 h-4" /> Add
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUploadSubmit}
          disabled={uploadItems.length === 0 || isUploading}
          className={`w-full py-2 sm:py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 
                       text-base sm:text-lg transition-all active:scale-[0.98] ${
            uploadItems.length > 0 && !isUploading
              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
              : "bg-gray-400 text-gray-200 cursor-not-allowed"
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            "Upload All"
          )}
        </button>
      </div>
    </div>
  );
}