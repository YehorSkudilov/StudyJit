import React from "react";

interface FileCardProps {
  fileName: string;
  fileSize?: number;
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
  const fileSizeInKB = ((fileSize ?? 0) / 1024).toFixed(2);

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`p-6 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col transition-colors hover:bg-blue-50 dark:hover:bg-gray-700 hover:shadow-md cursor-pointer
        ${selected ? "ring-2 ring-blue-500" : ""}`} // ✅ matches QuizCard style
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {fileName}
          </h3>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-300">
          {fileSize !== undefined ? `${fileSizeInKB} KB` : "— KB"}
        </div>
      </div>
    </div>
  );
}
