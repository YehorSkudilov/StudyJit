// components/FileCard.js
import React from "react";

interface FileCardProps {
  fileName: string;
  fileSize: number;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export default function FileCard({
  fileName,
  fileSize,
  selected,
  onClick,
  onDoubleClick,
}: FileCardProps) {
  const fileSizeInKB = (fileSize / 1024).toFixed(2); // Convert size from bytes to KB

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md cursor-pointer select-none ${
        selected ? "bg-blue-100 dark:bg-blue-700" : "hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
      style={{ userSelect: "none", outline: "none" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="mr-3">
            {/* You can add an icon here, for example, a file icon */}
            <svg
              className="w-6 h-6 text-gray-500 dark:text-gray-400"
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
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {fileName}
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-300">{fileSizeInKB} KB</div>
      </div>
    </div>
  );
}
