import { ArrowLeft, Folder as FolderIcon, BookOpen, Trash2, Move } from "lucide-react";

interface DashboardHeaderProps {
  activeFolder: string | null;
  goBack: () => void;
  selectedFolders: string[];
  selectedQuizzes: string[];
  onDeleteSelected: () => void;
}

export default function DashboardHeader({
  activeFolder,
  goBack,
  selectedFolders,
  selectedQuizzes,
  onDeleteSelected,
}: DashboardHeaderProps) {
  const hasSelection = selectedFolders.length > 0 || selectedQuizzes.length > 0;

  return (
    <section className="px-6 sm:px-20 py-10 relative">
      <div className="relative w-full flex items-center justify-center">
        {/* Centered Title */}
        <h1 className="text-4xl sm:text-5xl font-extrabold flex items-center gap-3 text-center">
          {activeFolder ? (
            <FolderIcon className="w-8 h-8 text-yellow-500 dark:text-yellow-400" />
          ) : (
            <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          )}
          {activeFolder || "Learning Space"}
        </h1>

        {/* Back button on the left */}
        {activeFolder && (
          <button
            onClick={goBack}
            className="absolute left-0 flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        )}

        {/* Action buttons on the right */}
        {hasSelection && (
          <div className="absolute right-0 flex gap-3">
            <button
              onClick={onDeleteSelected}
              className="p-3 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition"
              title="Delete Selected"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => alert("Move feature not implemented")}
              className="p-3 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition"
              title="Move Selected"
            >
              <Move className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
