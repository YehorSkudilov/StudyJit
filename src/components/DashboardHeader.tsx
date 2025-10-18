import { ChevronLeft, Folder as FolderIcon, BookOpen, Trash2, Move, CheckSquare, XSquare } from "lucide-react";

interface DashboardHeaderProps {
  activeFolder: string | null;
  goBack: () => void;
  selectedItems: string[]; // Array for selected folders and quizzes
  onDeleteSelected: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function DashboardHeader({
  activeFolder,
  goBack,
  selectedItems,
  onDeleteSelected,
  onSelectAll,
  onDeselectAll,
}: DashboardHeaderProps) {
  const hasSelection = selectedItems.length > 0; // Check if there are selected items

  return (
    <section className="px-6 sm:px-20 py-10 relative">
      <div className="relative w-full flex items-center justify-center">
        {/* Back button on the left */}
        {activeFolder && (
          <button
            onClick={goBack}
            className="mr-4 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white rounded-full transition-colors cursor-pointer z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Centered Title */}
        <h1 className="text-4xl sm:text-5xl font-extrabold flex items-center gap-3 text-center">
          {activeFolder ? (
            <FolderIcon className="w-8 h-8 text-yellow-500 dark:text-yellow-400" />
          ) : (
            <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          )}
          {activeFolder || "Learning Space"}
        </h1>

        {/* Action buttons on the right */}
        <div className="absolute right-0 flex gap-3">
          {hasSelection && (
            <>
              <button
                onClick={onDeleteSelected}
                className="p-3 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition"
                title="Delete Selected"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => alert('Move feature not implemented')}
                className="p-3 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition"
                title="Move Selected"
              >
                <Move className="w-5 h-5" />
              </button>
            </>
          )}
          {/* Always visible select/deselect buttons */}
          <button
            onClick={onSelectAll}
            className="p-3 bg-green-500 text-white rounded-full shadow hover:bg-green-600 transition"
            title="Select All"
          >
            <CheckSquare className="w-5 h-5" />
          </button>
          <button
            onClick={onDeselectAll}
            className="p-3 bg-gray-400 text-white rounded-full shadow hover:bg-gray-500 transition"
            title="Deselect All"
          >
            <XSquare className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
