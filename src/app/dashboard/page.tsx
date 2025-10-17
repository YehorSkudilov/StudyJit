"use client";

import { useState } from "react";
import Header from "@/components/DashboardHeader";
import DashboardGrid from "@/components/DashboardGrid";
import FloatingAddButton from "@/components/FloatingAddButton";
import CreateItemPopup from "@/components/CreateItemPopup";

type Quiz = {
  name: string;
  score: number;
  folder?: string;
};

type Folder = {
  name: string;
  parent?: string;
};

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([
    { name: "Math 101 Quiz", score: 90, folder: "Math Notes" },
    { name: "Physics Chapter 3", score: 85, folder: "Physics Notes" },
    { name: "Algebra Basics", score: 70, folder: "Math Notes" },
    { name: "History Midterm", score: 92 },
  ]);

  const [folders, setFolders] = useState<Folder[]>([
    { name: "Math Notes" },
    { name: "Physics Notes" },
    { name: "Algebra", parent: "Math Notes" },
  ]);

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [lastIndex, setLastIndex] = useState<number | null>(null);
  const [isPopupOpen, setPopupOpen] = useState(false);

  const folderQuizzes = quizzes.filter(q => q.folder === activeFolder);
  const subfolders = folders.filter(f => f.parent === activeFolder || (!f.parent && activeFolder === null));

  // --- Handlers ---
  const handleCreateQuiz = (title: string, folder?: string) => {
    setQuizzes([...quizzes, { name: title, score: 0, folder: folder || activeFolder || "" }]);
    setPopupOpen(false);
  };

  const handleCreateFolder = (name: string, parent?: string) => {
    setFolders([...folders, { name, parent: parent || activeFolder || undefined }]);
    setPopupOpen(false);
  };

  const handleItemClick = (name: string, type: "folder" | "quiz", index: number, e: React.MouseEvent) => {
    const visibleItems = [
      ...subfolders.map(f => f.name),
      ...folderQuizzes.map(q => q.name),
      ...(!activeFolder ? quizzes.filter(q => !q.folder).map(q => q.name) : []),
    ];

    let startIndex = lastIndex !== null ? lastIndex : index;

    if (e.shiftKey) {
      const rangeStart = Math.min(startIndex, index);
      const rangeEnd = Math.max(startIndex, index);
      const rangeItems = visibleItems.slice(rangeStart, rangeEnd + 1);

      setSelectedItems(prev => Array.from(new Set([...prev, ...rangeItems])));
      setLastIndex(index);
      return;
    }

    setSelectedItems(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
    setLastIndex(index);
  };

  const handleDeleteSelected = () => {
    setFolders(prev => prev.filter(f => !selectedItems.includes(f.name)));
    setQuizzes(prev => prev.filter(q => !selectedItems.includes(q.name)));
    setSelectedItems([]);
    setLastIndex(null);
  };

  // --- New Select/Deselect Functions ---
  const handleSelectAll = () => {
    const visibleItems = [
      ...subfolders.map(f => f.name),
      ...folderQuizzes.map(q => q.name),
      ...(!activeFolder ? quizzes.filter(q => !q.folder).map(q => q.name) : []),
    ];
    setSelectedItems(visibleItems);
  };

  const handleDeselectAll = () => {
    setSelectedItems([]);
  };

  // --- JSX ---
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative">
    <Header
      activeFolder={activeFolder}
      goBack={() => setActiveFolder(folders.find(f => f.name === activeFolder)?.parent || null)}
      selectedFolders={selectedItems.filter(n => folders.map(f => f.name).includes(n))}
      selectedQuizzes={selectedItems.filter(n => quizzes.map(q => q.name).includes(n))}
      onDeleteSelected={handleDeleteSelected}
      onSelectAll={handleSelectAll}           // ⬅ added
      onDeselectAll={handleDeselectAll}       // ⬅ added
    />


      <main className="px-6 sm:px-20 pb-20">
        <DashboardGrid
          subfolders={subfolders}
          folderQuizzes={folderQuizzes}
          selectedItems={selectedItems}
          onItemClick={handleItemClick}
          onFolderDoubleClick={(name) => setActiveFolder(name)}
          onQuizDoubleClick={(name) => alert(`Open Quiz: ${name}`)}
          quizzes={quizzes}
          activeFolder={activeFolder}
          onReorder={(newOrder) => console.log("New order:", newOrder)}
        />
      </main>

      <FloatingAddButton onClick={() => setPopupOpen(true)} />

      <CreateItemPopup
        isOpen={isPopupOpen}
        onClose={() => setPopupOpen(false)}
        onCreateQuiz={handleCreateQuiz}
        onCreateFolder={handleCreateFolder}
      />
    </div>
  );
}
