import { X, FilePlus, FolderPlus } from "lucide-react";

type ActionChooserPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onUploadFiles: () => void;
  onCreateFolder: () => void;
};

export default function ActionChooserPopup({
  isOpen,
  onClose,
  onUploadFiles,
  onCreateFolder,
}: ActionChooserPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1 text-center">
            Choose Action
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onUploadFiles();
              onClose();
            }}
            className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition group"
          >
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <FilePlus className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col items-start text-left">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                Upload Files
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Upload one or multiple files
              </span>
            </div>
          </button>

          <button
            onClick={() => {
              onCreateFolder();
              onClose();
            }}
            className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition group"
          >
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <FolderPlus className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col items-start text-left">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                Create Folder
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Organize files in a new folder
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}