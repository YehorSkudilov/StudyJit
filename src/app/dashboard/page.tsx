"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/DashboardHeader";
import DashboardGrid from "@/components/DashboardGrid";
import FloatingAddButton from "@/components/FloatingAddButton";
import CreateItemPopup from "@/components/CreateItemPopup";

type Quiz = {
  id: number;
  name: string;
  description: string;
  folder?: string;
  generation_status?: "pending" | "success" | "failed" | null; // ✅ new field
};

type Folder = {
  name: string;
  parent?: string;
};

// ✅ Define lightweight type for double-click payload
type QuizPreview = { id: number; name: string };

export default function DashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [lastIndex, setLastIndex] = useState<number | null>(null);
  const [isPopupOpen, setPopupOpen] = useState(false);

  // ✅ Fetch quizzes from backend
  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const res = await fetch("/api/db/getQuizzes");
        if (!res.ok) throw new Error("Failed to load quizzes");

        const data = await res.json();

        // Generate folders dynamically from descriptions
        const derivedFolders: Folder[] = [];
        data.forEach((quiz: Quiz) => {
          if (quiz.description?.includes("folder")) {
            const match = quiz.description.match(/folder "(.*?)"/);
            if (match && !derivedFolders.some((f) => f.name === match[1])) {
              derivedFolders.push({ name: match[1] });
            }
          }
        });

        // ✅ Remove "root" folder if present
        const cleanedFolders = derivedFolders.filter(
          (f) => f.name.toLowerCase() !== "root"
        );

        setQuizzes(data);
        setFolders(cleanedFolders);
      } catch (err) {
        console.error("❌ Failed to load quizzes:", err);
      }
    };

    fetchQuizzes();
  }, []);

  const folderQuizzes = quizzes.filter((q) => q.folder === activeFolder);
  const subfolders = folders.filter(
    (f) => f.parent === activeFolder || (!f.parent && activeFolder === null)
  );

  // --- Handlers ---

  const handleCreateQuiz = async (title: string, folder?: string) => {
    try {
      const response = await fetch("/api/db/createQuiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizName: title,
          description: folder || activeFolder
            ? `Quiz created in folder "${folder || activeFolder}"`
            : "Quiz created at top level",
          questions: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to create quiz:", data.error);
        alert("Error: " + (data.error || "Failed to create quiz"));
        return;
      }

      // ✅ Refresh quizzes
      const updated = await fetch("/api/db/getQuizzes");
      setQuizzes(await updated.json());
      setPopupOpen(false);

      console.log("✅ Quiz created:", data);
    } catch (error) {
      console.error("❌ Error:", error);
      alert("Failed to connect to server.");
    }
  };

  const handleCreateFolder = (name: string, parent?: string) => {
    setFolders([...folders, { name, parent: parent || activeFolder || undefined }]);
    setPopupOpen(false);
  };

  const handleItemClick = (
    name: string,
    type: "folder" | "quiz",
    index: number,
    e: React.MouseEvent
  ) => {
    const visibleItems = [
      ...subfolders.map((f) => f.name),
      ...folderQuizzes.map((q) => q.name),
      ...(!activeFolder
        ? quizzes.filter((q) => !q.folder).map((q) => q.name)
        : []),
    ];

    let startIndex = lastIndex !== null ? lastIndex : index;

    if (e.shiftKey) {
      const rangeStart = Math.min(startIndex, index);
      const rangeEnd = Math.max(startIndex, index);
      const rangeItems = visibleItems.slice(rangeStart, rangeEnd + 1);

      setSelectedItems((prev) =>
        Array.from(new Set([...prev, ...rangeItems]))
      );
      setLastIndex(index);
      return;
    }

    setSelectedItems((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name]
    );
    setLastIndex(index);
  };

  const handleDeleteSelected = () => {
    setFolders((prev) => prev.filter((f) => !selectedItems.includes(f.name)));
    setQuizzes((prev) => prev.filter((q) => !selectedItems.includes(q.name)));
    setSelectedItems([]);
    setLastIndex(null);
  };

  const handleSelectAll = () => {
    const visibleItems = [
      ...subfolders.map((f) => f.name),
      ...folderQuizzes.map((q) => q.name),
      ...(!activeFolder
        ? quizzes.filter((q) => !q.folder).map((q) => q.name)
        : []),
    ];
    setSelectedItems(visibleItems);
  };

  const handleDeselectAll = () => setSelectedItems([]);

  // --- JSX ---
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative">
      <Header
        activeFolder={activeFolder}
        goBack={() =>
          setActiveFolder(
            folders.find((f) => f.name === activeFolder)?.parent || null
          )
        }
        selectedItems={selectedItems} // Pass single selectedItems array
        onDeleteSelected={handleDeleteSelected}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
      />

      <main className="px-6 sm:px-20 pb-20">
        <DashboardGrid
          subfolders={subfolders}
          folderQuizzes={folderQuizzes}
          selectedItems={selectedItems}
          onItemClick={handleItemClick}
          onFolderDoubleClick={(name) => setActiveFolder(name)}
          // ✅ Now matches the Grid prop exactly
          onQuizDoubleClick={(quiz: QuizPreview) => {
            sessionStorage.setItem("selectedQuizId", quiz.id.toString());
            router.push(`/quizDetails/${encodeURIComponent(quiz.name)}`);
          }}
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
