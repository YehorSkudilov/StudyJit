import React from "react";
import {
  ChevronLeft,
  Trash2,
  Move,
  CheckSquare,
  XSquare,
  LucideIcon,
} from "lucide-react";

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon; // You can pass any Lucide icon
  activeFolder?: string | null;
  goBack?: () => void;
  selectedItems?: string[];
  onDeleteSelected?: () => void;
  onMoveSelected?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  children?: React.ReactNode; // Optional custom actions
  color?: "blue" | "yellow" | "green" | "red"; // Optional theme tint
}

export default function PageHeader({
  title,
  icon: Icon,
  activeFolder,
  goBack,
  selectedItems = [],
  onDeleteSelected,
  onMoveSelected,
  onSelectAll,
  onDeselectAll,
  children,
  color = "blue",
}: PageHeaderProps) {
  const hasSelection = selectedItems.length > 0;

  const colorClasses = {
    blue: "text-blue-600 dark:text-blue-400 ring-blue-500 bg-blue-500 hover:bg-blue-600",
    yellow: "text-yellow-500 dark:text-yellow-400 ring-yellow-500 bg-yellow-500 hover:bg-yellow-600",
    green: "text-green-500 dark:text-green-400 ring-green-500 bg-green-500 hover:bg-green-600",
    red: "text-red-500 dark:text-red-400 ring-red-500 bg-red-500 hover:bg-red-600",
  };

  return (
    <section className="px-6 sm:px-20 py-10 relative">
      <div className="relative w-full flex items-center justify-center">
        {/* Back button */}
        {activeFolder && goBack && (
          <button
            onClick={goBack}
            className="mr-4 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white rounded-full transition-colors cursor-pointer z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Center Title */}
        <h1 className="text-4xl sm:text-5xl font-extrabold flex items-center gap-3 text-center">
          {Icon && <Icon className={`w-8 h-8 ${colorClasses[color].split(" ")[0]}`} />}
          {activeFolder || title}
        </h1>

        {/* Right action buttons */}
        <div className="absolute right-0 flex gap-3">
          {hasSelection && (
            <>
              {onDeleteSelected && (
                <button
                  onClick={onDeleteSelected}
                  className="p-3 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition"
                  title="Delete Selected"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              {onMoveSelected && (
                <button
                  onClick={onMoveSelected}
                  className="p-3 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition"
                  title="Move Selected"
                >
                  <Move className="w-5 h-5" />
                </button>
              )}
            </>
          )}

          {onSelectAll && (
            <button
              onClick={onSelectAll}
              className="p-3 bg-green-500 text-white rounded-full shadow hover:bg-green-600 transition"
              title="Select All"
            >
              <CheckSquare className="w-5 h-5" />
            </button>
          )}

          {onDeselectAll && (
            <button
              onClick={onDeselectAll}
              className="p-3 bg-gray-400 text-white rounded-full shadow hover:bg-gray-500 transition"
              title="Deselect All"
            >
              <XSquare className="w-5 h-5" />
            </button>
          )}

          {/* Optional extra controls */}
          {children}
        </div>
      </div>
    </section>
  );
}
