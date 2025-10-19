import React from "react";

interface FileCardProps {
  fileName: string;
  fileSize?: number; // bytes
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

// ✅ helper to display KB / MB / GB nicely
function formatSize(size?: number): string {
  if (size == null) return "—";
  if (size < 1024) return `${size.toFixed(0)} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(2)} MB`;
  return `${(size / 1024 ** 3).toFixed(2)} GB`;
}

export default function FileCard({
  fileName,
  fileSize,
  selected,
  onClick,
  onDoubleClick,
}: FileCardProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`p-6 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col transition-colors hover:bg-blue-50 dark:hover:bg-gray-700 hover:shadow-md cursor-pointer ${
        selected ? "ring-2 ring-blue-500" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2 w-full">
          <svg
            className="w-6 h-6 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-1"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
            />
          </svg>

          {/* ✅ Full name shown, wraps naturally */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 break-words whitespace-normal">
              {fileName}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-300">
              {formatSize(fileSize)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
