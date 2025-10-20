"use client";

import { X } from "lucide-react";
import React from "react";

export interface ActionItem {
  key: string;
  title: string;
  subtitle?: string;
  color?: string; // Tailwind color prefix like "blue", "green", etc.
  icon: React.ElementType;
  onClick: () => void;
}

interface GenericActionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionItem[];
}

export default function GenericActionPopup({
  isOpen,
  onClose,
  title = "Choose Action",
  actions,
}: GenericActionPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1 text-center">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Actions */}
        <div className="flex flex-col gap-3">
          {actions.map((action) => {
            const base = action.color ?? "blue";
            return (
              <button
                key={action.key}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                className={`flex items-center gap-3 p-4 border-2 rounded-xl transition group
                  bg-${base}-50 dark:bg-${base}-900/20
                  border-${base}-200 dark:border-${base}-700
                  hover:bg-${base}-100 dark:hover:bg-${base}-900/30`}
              >
                <div
                  className={`w-12 h-12 bg-${base}-600 rounded-lg flex items-center justify-center flex-shrink-0`}
                >
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
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
