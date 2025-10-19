"use client";
import React, { useEffect, useState } from "react";
import { File, Search, Check } from "lucide-react";

interface FileItem {
  id: number;
  name: string;
  size: number;
}

interface QuizAddFilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFiles: (files: FileItem[]) => void; // ✅ Now accepts multiple files
  existingFileIds: number[];
}

export default function QuizAddFilePopup({
  isOpen,
  onClose,
  onAddFiles,
  existingFileIds,
}: QuizAddFilePopupProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles(new Set()); // Reset selection when closed
      return;
    }

    const fetchFiles = async () => {
      try {
        const res = await fetch("/api/db/files");
        const data = await res.json();
const fetchedFiles = data.map((f: FileItem) => ({
  ...f,
  preselected: existingFileIds.includes(f.id),
}));
setFiles(fetchedFiles);
setSelectedFiles(new Set(existingFileIds)); // Show them as selected

        setFiles(fetchedFiles);
      } catch (err) {
        console.error("❌ Failed to load files:", err);
      }
    };

    fetchFiles();
  }, [isOpen, existingFileIds]);

  if (!isOpen) return null;

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(search.toLowerCase())
  );

const toggleFile = (fileId: number) => {
  setSelectedFiles((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(fileId)) {
      newSet.delete(fileId);
    } else {
      if (newSet.size >= 10) {
        alert("You can select up to 10 files only.");
        return prev;
      }
      newSet.add(fileId);
    }
    return newSet;
  });
};


const handleAddFiles = () => {
  const filesToAdd = files.filter((file) => selectedFiles.has(file.id));
  onAddFiles(filesToAdd);
  onClose();
};


  const selectAll = () => {
    setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
  };

  const deselectAll = () => {
    setSelectedFiles(new Set());
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-[480px]">
        <h2 className="text-xl font-semibold mb-4 text-center text-gray-900 dark:text-gray-100">
          Add Files to Quiz
        </h2>

        {/* 🔍 Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded border border-gray-300 dark:border-gray-600 
              bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Selection Controls */}
        {filteredFiles.length > 0 && (
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {selectedFiles.size} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Select All
              </button>
              {selectedFiles.size > 0 && (
                <button
                  onClick={deselectAll}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Deselect All
                </button>
              )}
            </div>
          </div>
        )}

        {filteredFiles.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            {files.length === 0
              ? "No available files to add."
              : "No files match your search."}
          </p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto pr-2 mb-4">
            {filteredFiles.map((file) => {
              const isSelected = selectedFiles.has(file.id);
              return (
<ul className="space-y-2 max-h-80 overflow-y-auto pr-2 mb-4">
  {filteredFiles.map((file) => {
    const isSelected = selectedFiles.has(file.id);
    return (
      <li
        key={file.id}
        onClick={() => toggleFile(file.id)}
        className={`cursor-pointer p-3 rounded transition flex justify-between items-center
          ${
            isSelected
              ? "bg-blue-100 dark:bg-blue-900 border-2 border-blue-500"
              : "hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent"
          }`}
      >
        {/* file info */}
      </li>
    );
  })}
</ul>

              );
            })}
          </ul>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600 
              text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAddFiles}
            disabled={selectedFiles.size === 0}
            className={`px-4 py-2 rounded transition
              ${
                selectedFiles.size > 0
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
          >
            Add {selectedFiles.size > 0 ? `(${selectedFiles.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}