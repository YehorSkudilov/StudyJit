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
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE";
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`card card-hover group h-full p-5 flex flex-col gap-3 cursor-pointer ${
        selected ? "ring-2 ring-brand border-brand" : ""
      }`}
    >
      <span className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-extrabold tracking-wide transition group-hover:scale-110">
        {ext}
      </span>
      <div className="min-w-0">
        <h3 className="font-bold leading-snug break-words line-clamp-2">{fileName}</h3>
        <span className="text-xs text-muted">{formatSize(fileSize)}</span>
      </div>
    </div>
  );
}
