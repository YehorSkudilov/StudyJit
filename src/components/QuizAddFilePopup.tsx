"use client";
import React, { useEffect, useState } from "react";
import { File, Search } from "lucide-react";

interface FileItem {
  id: number;
  name: string;
  size: number;
}

interface QuizAddFilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFile: (file: FileItem) => void; // ✅ full file object
  existingFileIds: number[];
}

export default function QuizAddFilePopup({
  isOpen,
  onClose,
  onAddFile,
  existingFileIds,
}: QuizAddFilePopupProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const fetchFiles = async () => {
      try {
        const res = await fetch("/api/db/files");
        const data = await res.json();
        const filtered = data.filter(
          (f: FileItem) => !existingFileIds.includes(f.id)
        );
        setFiles(filtered);
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-[420px]">
        <h2 className="text-xl font-semibold mb-4 text-center text-gray-900 dark:text-gray-100">
          Add File to Quiz
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

        {filteredFiles.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center">
            {files.length === 0
              ? "No available files to add."
              : "No files match your search."}
          </p>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {filteredFiles.map((file) => (
              <li
                key={file.id}
                onClick={() => {
                  onAddFile(file); // ✅ local only
                  onClose();
                }}
                className="cursor-pointer p-3 rounded hover:bg-blue-100 dark:hover:bg-blue-700 
                  transition flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <File className="w-5 h-5 text-blue-500" />
                  <span className="truncate max-w-[220px] text-gray-900 dark:text-gray-100">
                    {file.name}
                  </span>
                </div>
                <span className="text-sm text-gray-400 dark:text-gray-300">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600 
              text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
