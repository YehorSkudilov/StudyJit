"use client";

import React from "react";
import {
  ChevronLeft,
  Trash2,
  CheckSquare,
  XSquare,
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
  goBack?: () => void;
  showBack?: boolean; // ✅ added this line
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
  goBack,
  showBack = false, // ✅ default false
  selectedItems = [],
  onDeleteSelected,
  onSelectAll,
  onDeselectAll,
  extraActions = [],
  children,
  color = "blue",
}: PageHeaderProps) {
  const hasSelection = selectedItems.length > 0;

  const colorClasses = {
    blue: "text-blue-600 dark:text-blue-400 ring-blue-500 bg-blue-500 hover:bg-blue-600",
    yellow:
      "text-yellow-500 dark:text-yellow-400 ring-yellow-500 bg-yellow-500 hover:bg-yellow-600",
    green:
      "text-green-500 dark:text-green-400 ring-green-500 bg-green-500 hover:bg-green-600",
    red: "text-red-500 dark:text-red-400 ring-red-500 bg-red-500 hover:bg-red-600",
  };

  return (
    <section className="px-4 sm:px-10 py-6 sm:py-10 relative">
      <div
        className="
          flex flex-col sm:flex-row sm:items-center sm:justify-between
          text-center sm:text-left gap-4 sm:gap-0
        "
      >
        {/* Left section: Back + Title */}
        <div className="flex items-center justify-center sm:justify-start gap-3 relative">
          {showBack && goBack && ( // ✅ use showBack prop
            <button
              onClick={goBack}
              className="p-2 sm:p-3 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Go Back"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          <h1 className="text-2xl sm:text-4xl font-extrabold flex items-center gap-2 sm:gap-3 leading-tight">
            {Icon && (
              <Icon
                className={`w-6 h-6 sm:w-8 sm:h-8 ${colorClasses[color].split(" ")[0]}`}
              />
            )}
            <span className="truncate max-w-[80vw]">{activeFolder || title}</span>
          </h1>
        </div>

        {/* Right section: Actions */}
        <div className="flex justify-center sm:justify-end flex-wrap gap-2 sm:gap-3">
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
