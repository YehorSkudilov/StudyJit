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
  onDoubleClick 
}: FolderCardProps) {
  return (
    <div
      className={`p-6 bg-white dark:bg-gray-800 rounded-xl shadow flex gap-4 items-center hover:bg-blue-50 dark:hover:bg-gray-700 transition cursor-pointer h-full
        ${selected ? "ring-2 ring-blue-500" : ""}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <Folder className="w-8 h-8 text-yellow-500 flex-shrink-0" />
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <h3 className="font-semibold text-lg truncate">{folderName}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {itemCount} item{itemCount !== 1 && "s"}
        </p>
      </div>
    </div>
  );
}