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

  // keep rename input synced with latest folder name
  useEffect(() => {
    setNewName(activeFolder || title);
  }, [activeFolder, title]);

  // reset rename mode when navigating to another folder
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
    blue: "text-blue-600 dark:text-blue-400",
    yellow: "text-yellow-500 dark:text-yellow-400",
    green: "text-green-500 dark:text-green-400",
    red: "text-red-500 dark:text-red-400",
  };

  return (
    <section className="relative px-4 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 bg-transparent mb-3 sm:mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        {/* ← Left: Back + Title */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center sm:justify-start">
          {showBack && goBack && (
            <button
              onClick={goBack}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Go Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {Icon && <Icon className={`w-6 h-6 ${colorClasses[color]}`} />}

          {!editing ? (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold truncate text-center sm:text-left text-gray-900 dark:text-gray-100">
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
                className="border border-gray-400 dark:border-gray-600 rounded-lg px-2 py-1 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none w-44 sm:w-64"
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

        {/* ↓ Second line: Actions */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-3 mt-1 sm:mt-0">
          {hasSelection && onDeleteSelected && (
            <button
              onClick={onDeleteSelected}
              className="p-2 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition"
              title="Delete Selected"
            >
              <Trash2 className="w-4 h-4" />
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
                className={`p-2 rounded-full shadow transition text-white ${colorClass}`}
                title={action.label}
              >
                <action.icon className="w-4 h-4" />
              </button>
            );
          })}

          {onSelectAll && (
            <button
              onClick={onSelectAll}
              className="p-2 bg-green-500 text-white rounded-full shadow hover:bg-green-600 transition"
              title="Select All"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          )}

          {onDeselectAll && (
            <button
              onClick={onDeselectAll}
              className="p-2 bg-gray-400 text-white rounded-full shadow hover:bg-gray-500 transition"
              title="Deselect All"
            >
              <XSquare className="w-4 h-4" />
            </button>
          )}

          {children}
        </div>
      </div>
    </section>
  );
}
