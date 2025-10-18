import { Folder as FolderIcon } from "lucide-react";

interface FolderCardProps {
  folderName: string;
  quizCount: number;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export default function FolderCard({ folderName, quizCount, selected, onClick, onDoubleClick }: FolderCardProps) {
  return (
   <div
  className={`p-6 bg-white dark:bg-gray-800 rounded-xl shadow flex gap-4 items-stretch hover:bg-blue-50 dark:hover:bg-gray-700 transition cursor-pointer
    ${selected ? "ring-2 ring-blue-500" : ""}`}
  onClick={onClick}
  onDoubleClick={onDoubleClick}
>
  <FolderIcon className="w-6 h-full text-yellow-500 flex-shrink-0" />
  <div className="flex flex-col justify-center">
    <h3 className="font-semibold text-lg">{folderName}</h3>
    <p className="text-gray-500 dark:text-gray-400 text-sm">
      {quizCount} item{quizCount !== 1 && "s"}
    </p>
  </div>
</div>
  );
}
