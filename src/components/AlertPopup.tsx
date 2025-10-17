"use client";

import { AlertTriangle } from "lucide-react";

interface AlertPopupProps {
  message: string;
  onClose: () => void;
}

export default function AlertPopup({ message, onClose }: AlertPopupProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-lg p-6 w-80 text-center">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
        <p className="text-lg font-medium mb-5">{message}</p>
        <button
          onClick={onClose}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          OK
        </button>
      </div>
    </div>
  );
}
