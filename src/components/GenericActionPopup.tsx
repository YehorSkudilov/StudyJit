"use client";

import { X } from "lucide-react";
import React from "react";

export interface ActionItem {
  key: string;
  title: string;
  subtitle?: string;
  color?: "blue" | "green" | "yellow" | "purple" | "red";
  icon: React.ElementType;
  onClick: () => void;
}

interface GenericActionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionItem[];
}

// ✅ Static Tailwind color mappings
const colorClasses = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-700",
    hover: "hover:bg-blue-100 dark:hover:bg-blue-900/30",
    solid: "bg-blue-600",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-700",
    hover: "hover:bg-green-100 dark:hover:bg-green-900/30",
    solid: "bg-green-600",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    border: "border-yellow-200 dark:border-yellow-700",
    hover: "hover:bg-yellow-100 dark:hover:bg-yellow-900/30",
    solid: "bg-yellow-500",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-700",
    hover: "hover:bg-purple-100 dark:hover:bg-purple-900/30",
    solid: "bg-purple-600",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-700",
    hover: "hover:bg-red-100 dark:hover:bg-red-900/30",
    solid: "bg-red-600",
  },
};

export default function GenericActionPopup({
  isOpen,
  onClose,
  title = "Choose Action",
  actions,
}: GenericActionPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 sm:px-0">
      <div
        className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl
                   w-[90vw] sm:w-full sm:max-w-md
                   max-h-[85vh] overflow-y-auto
                   p-5 sm:p-6 flex flex-col gap-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
          <div className="w-12 sm:w-16"></div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 flex-1 text-center">
            {title}
          </h2>
          <div className="w-12 sm:w-16 flex justify-end">
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {actions.map((action) => {
            const color = colorClasses[action.color || "blue"];
            return (
              <button
                key={action.key}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                className={`flex items-center gap-3 p-4 border-2 rounded-xl transition group
                  ${color.bg} ${color.border} ${color.hover}`}
              >
                <div
                  className={`w-12 h-12 ${color.solid} rounded-lg flex items-center justify-center flex-shrink-0`}
                >
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-base sm:text-lg">
                    {action.title}
                  </span>
                  {action.subtitle && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {action.subtitle}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
