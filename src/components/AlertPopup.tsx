"use client";

import { AlertTriangle } from "lucide-react";

interface AlertAction {
  label: string;
  color?: "blue" | "red" | "gray";
  onClick: () => void;
}

interface AlertPopupProps {
  message: string;
  onClose: () => void;
  actions?: AlertAction[]; // optional multiple buttons
}

export default function AlertPopup({ message, onClose, actions }: AlertPopupProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-lg p-6 w-80 text-center">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
        <p className="text-lg font-medium mb-6">{message}</p>

        {actions && actions.length > 0 ? (
          <div className="flex justify-center gap-3">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`px-5 py-2 rounded-lg font-medium transition ${
                  action.color === "red"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : action.color === "gray"
                    ? "bg-gray-400 hover:bg-gray-500 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
}
