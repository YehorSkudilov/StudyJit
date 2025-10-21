"use client";

import { useState } from "react";
import { X, Folder, FolderOpen, Home } from "lucide-react";

interface FolderNode {
  id: string;
  name: string;
  parent_id: string | null;
}

interface MoveItemPopupProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderNode[];
  onMove: (destinationId: string | null) => Promise<void>;
  showRoot?: boolean; // ✅ new prop
}

export default function MoveItemPopup({
  isOpen,
  onClose,
  folders,
  onMove,
  showRoot = true, // ✅ default true
}: MoveItemPopupProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  /* --------------------- Helpers --------------------- */

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleConfirm = async () => {
    await onMove(selectedFolder);
    onClose();
  };

  const getChildren = (parentId: string | null) =>
    folders.filter((f) => f.parent_id === parentId);

  /* ------------------- Tree Rendering ------------------- */

  const renderTree = (parentId: string | null, depth = 0): React.ReactNode => {
    return getChildren(parentId).map((folder) => {
      const isExpanded = expanded.has(folder.id);
      const isSelected = selectedFolder === folder.id;

      return (
        <div key={folder.id}>
          <div
            onClick={() => setSelectedFolder(folder.id)}
            onDoubleClick={() => toggleExpand(folder.id)}
            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition select-none
              ${
                isSelected
                  ? "bg-blue-100 dark:bg-blue-900"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            style={{ marginLeft: `${depth * 1.25}rem` }}
          >
            {isExpanded ? (
              <FolderOpen className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            ) : (
              <Folder className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            )}
            <span className="text-gray-800 dark:text-gray-100">{folder.name}</span>
          </div>

          {isExpanded && renderTree(folder.id, depth + 1)}
        </div>
      );
    });
  };

  /* ----------------------- UI ----------------------- */

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-sm max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Move to Folder
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Folder List */}
        <div className="overflow-y-auto flex-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
          {/* ✅ Root (only show if allowed) */}
          {showRoot && (
            <div
              onClick={() => setSelectedFolder(null)}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition select-none
                ${
                  selectedFolder === null
                    ? "bg-blue-100 dark:bg-blue-900"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
            >
              <Home className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <span className="text-gray-800 dark:text-gray-100">Root</span>
            </div>
          )}

          {/* Tree */}
          {renderTree(null)}
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={selectedFolder === undefined}
          className={`mt-4 w-full py-2 rounded-md flex items-center justify-center gap-2 font-medium
            ${
              selectedFolder === undefined
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
        >
          <Folder className="w-4 h-4" /> Move Here
        </button>
      </div>
    </div>
  );
}
