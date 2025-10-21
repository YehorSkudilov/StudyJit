"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  Trash2,
  CheckSquare,
  XSquare,
  Pencil,
  Check,
  LucideIcon,
} from "lucide-react";

/* -------------------- Types -------------------- */
interface ExtraAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: "blue" | "red" | "green" | "yellow";
}

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
  activeFolder?: string | null;
  canRename?: boolean;
  onRename?: (newName: string) => Promise<void>;
  goBack?: () => void;
  showBack?: boolean;
  selectedItems?: string[];
  onDeleteSelected?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  extraActions?: ExtraAction[];
  children?: React.ReactNode;
  color?: "blue" | "yellow" | "green" | "red";
}

/* -------------------- Component -------------------- */
export default function PageHeader({
  title,
  icon: Icon,
  activeFolder,
  canRename = false,
  onRename,
  goBack,
  showBack = false,
  selectedItems = [],
  onDeleteSelected,
  onSelectAll,
  onDeselectAll,
  extraActions = [],
  children,
  color = "blue",
}: PageHeaderProps) {
  const hasSelection = selectedItems.length > 0;

  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(activeFolder || title);

  // 🧩 FIX: keep rename input synced with latest folder name
  useEffect(() => {
    setNewName(activeFolder || title);
  }, [activeFolder, title]);

  // 🧩 FIX: keep rename input synced with latest folder name
useEffect(() => {
  setNewName(activeFolder || title);
}, [activeFolder, title]);

// 🧭 Reset rename mode when navigating to another folder
useEffect(() => {
  setEditing(false);
}, [activeFolder]);

  const handleRenameConfirm = async () => {
    if (newName.trim() && onRename) {
      await onRename(newName.trim());
      setEditing(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleRenameConfirm();
    } else if (e.key === "Escape") {
      setEditing(false);
      setNewName(activeFolder || title);
    }
  };

  const colorClasses = {
    blue: "text-blue-600 dark:text-blue-400 ring-blue-500 bg-blue-500 hover:bg-blue-600",
    yellow:
      "text-yellow-500 dark:text-yellow-400 ring-yellow-500 bg-yellow-500 hover:bg-yellow-600",
    green:
      "text-green-500 dark:text-green-400 ring-green-500 bg-green-500 hover:bg-green-600",
    red: "text-red-500 dark:text-red-400 ring-red-500 bg-red-500 hover:bg-red-600",
  };

  return (
    <section className="relative px-4 sm:px-10 py-6 sm:py-10">
      <div className="relative flex items-center justify-between">
        {/* ← Left: Back Button */}
        <div className="flex items-center gap-2">
          {showBack && goBack && (
            <button
              onClick={goBack}
              className="p-2 sm:p-3 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Go Back"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>

        {/* 🧭 Center: Title + Rename */}
        <div className="absolute left-1/2 transform -translate-x-1/2 text-center flex items-center gap-3">
          {Icon && (
            <Icon
              className={`w-6 h-6 sm:w-8 sm:h-8 ${colorClasses[color].split(" ")[0]}`}
            />
          )}

          {!editing ? (
            <>
              <h1 className="text-2xl sm:text-4xl font-extrabold truncate max-w-[65vw] leading-tight">
                {activeFolder || title}
              </h1>
              {canRename && (
                <button
                  onClick={() => setEditing(true)}
                  title="Rename Folder"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <input
                className="border border-gray-400 dark:border-gray-600 rounded-lg px-3 py-1 text-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <button
                onClick={handleRenameConfirm}
                className="p-1 text-green-600 hover:text-green-700"
                title="Confirm Rename"
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setNewName(activeFolder || title);
                }}
                className="p-1 text-gray-500 hover:text-gray-700"
                title="Cancel"
              >
                <XSquare className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* → Right: Actions */}
        <div className="flex items-center justify-end gap-2 sm:gap-3">
          {hasSelection && (
            <>
              {onDeleteSelected && (
                <button
                  onClick={onDeleteSelected}
                  className="p-2 sm:p-3 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition"
                  title="Delete Selected"
                >
                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {extraActions.map((action, i) => {
                const colorClass = action.disabled
                  ? "bg-gray-400 cursor-not-allowed"
                  : action.color === "red"
                  ? "bg-red-500 hover:bg-red-600"
                  : action.color === "green"
                  ? "bg-green-500 hover:bg-green-600"
                  : action.color === "yellow"
                  ? "bg-yellow-500 hover:bg-yellow-600"
                  : "bg-blue-500 hover:bg-blue-600";

                return (
                  <button
                    key={i}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`p-2 sm:p-3 rounded-full shadow transition text-white ${colorClass}`}
                    title={action.label}
                  >
                    <action.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                );
              })}
            </>
          )}

          {onSelectAll && (
            <button
              onClick={onSelectAll}
              className="p-2 sm:p-3 bg-green-500 text-white rounded-full shadow hover:bg-green-600 transition"
              title="Select All"
            >
              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {onDeselectAll && (
            <button
              onClick={onDeselectAll}
              className="p-2 sm:p-3 bg-gray-400 text-white rounded-full shadow hover:bg-gray-500 transition"
              title="Deselect All"
            >
              <XSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {children}
        </div>
      </div>
    </section>
  );
}
