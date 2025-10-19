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
      className={`group relative p-6 rounded-xl cursor-pointer flex items-center gap-4 shadow-sm border transition-all
        ${
          selected
            ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "bg-gradient-to-br from-yellow-50 to-white dark:from-gray-800 dark:to-gray-900 hover:shadow-md hover:scale-[1.02]"
        }`}
    >
      <div
        className={`flex items-center justify-center w-14 h-14 rounded-lg transition-transform
          ${
            selected
              ? "bg-blue-500 text-white"
              : "bg-yellow-400/90 group-hover:bg-yellow-500 text-white"
          }`}
      >
        <Folder className="w-7 h-7" />
      </div>
      <div className="flex flex-col min-w-0">
        <h3
          className={`font-semibold text-lg truncate ${
            selected ? "text-blue-600 dark:text-blue-300" : ""
          }`}
        >
          {folderName}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {itemCount} item{itemCount !== 1 && "s"}
        </p>
      </div>
    </div>
  );
}
