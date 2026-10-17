import React from "react";
import { Folder } from "lucide-react";

interface FolderCardProps {
  folderName: string;
  itemCount: number;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export default function FolderCard({
  folderName,
  itemCount,
  selected,
  onClick,
  onDoubleClick,
}: FolderCardProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`p-6 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col transition-colors hover:bg-blue-50 dark:hover:bg-gray-700 hover:shadow-md cursor-pointer ${
        selected ? "ring-2 ring-blue-500" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Folder className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />

        <div className="flex flex-col flex-1 overflow-hidden">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 break-words whitespace-normal">
            {folderName}
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-300">
            {itemCount} item{itemCount !== 1 && "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
