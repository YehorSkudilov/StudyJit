"use client";
import { useState } from "react";
import { X, Folder } from "lucide-react";

interface MoveItemPopupProps {
  isOpen: boolean;
  onClose: () => void;
  folders: string[];
  onMove: (destinationPath: string) => Promise<void>;
}

export default function MoveItemPopup({
  isOpen,
  onClose,
  folders,
  onMove,
}: MoveItemPopupProps) {
  const [selectedPath, setSelectedPath] = useState("root");

  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onMove(selectedPath);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Move to Folder</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <select
          value={selectedPath}
          onChange={(e) => setSelectedPath(e.target.value)}
          className="w-full border rounded-md p-2 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="root">📁 Root</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <button
          onClick={handleConfirm}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md flex items-center justify-center gap-2"
        >
          <Folder className="w-4 h-4" /> Move Here
        </button>
      </div>
    </div>
  );
}
