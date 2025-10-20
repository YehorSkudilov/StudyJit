"use client";

import { X, ArrowLeft, Folder } from "lucide-react";
import { useState } from "react";

type CreateFolderPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (name: string) => void;
};

export default function CreateFolderPopup({
  isOpen,
  onClose,
  onCreateFolder,
}: CreateFolderPopupProps) {
  const [folderName, setFolderName] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (folderName.trim() !== "") {
      onCreateFolder(folderName.trim());
      setFolderName("");
      onClose();
    }
  };

  const handleCancel = () => {
    setFolderName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-lg flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="w-16"></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex-1 text-center">
            New Folder
          </h2>
          <div className="w-16 flex justify-end">
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Input */}
        <input
          type="text"
          placeholder="Enter Folder Name"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
        />

        {/* Create Button */}
        <button
          onClick={handleSubmit}
          className="w-full bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600 transition flex justify-center items-center gap-2"
        >
          <Folder className="w-5 h-5" /> Create Folder
        </button>
      </div>
    </div>
  );
}
