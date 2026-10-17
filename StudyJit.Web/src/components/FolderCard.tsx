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
      className={`card card-hover group h-full p-5 flex flex-col gap-3 cursor-pointer ${
        selected ? "ring-2 ring-brand border-brand" : ""
      }`}
    >
      <span className="w-10 h-10 rounded-xl bg-amber-400/15 text-amber-500 flex items-center justify-center transition group-hover:scale-110 group-hover:-rotate-6">
        <Folder className="w-5 h-5 fill-amber-400/30" />
      </span>
      <div className="min-w-0">
        <h3 className="font-bold leading-snug break-words line-clamp-2">{folderName}</h3>
        <span className="text-xs text-muted">
          {itemCount} item{itemCount !== 1 && "s"}
        </span>
      </div>
    </div>
  );
}
