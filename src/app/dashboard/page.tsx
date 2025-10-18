"use client";

import React, { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import GenericGrid from "@/components/GenericGrid";
import FloatingAddButton from "@/components/FloatingAddButton";
import CreateItemPopup from "@/components/CreateItemPopup";
import QuizCard from "@/components/QuizCard";
import { Item } from "@/types/Item";
import { BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Item[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isPopupOpen, setPopupOpen] = useState(false);
  const router = useRouter();

  // ✅ Define fetchQuizzes so it can be reused
  const fetchQuizzes = async () => {
    try {
      const res = await fetch("/api/db/getQuizzes");
      const data = await res.json();
      console.log("✅ API returned:", data);

      // Derive folders
      const derivedFolders: Item[] = [];
      data.forEach((quiz: Item) => {
        if (quiz.description?.includes("folder")) {
          const match = quiz.description.match(/folder\s+"(.*?)"/);
          if (match && match[1]) {
            const folderName = match[1];
            if (!derivedFolders.some((f) => f.name === folderName)) {
              derivedFolders.push({
                id: folderName,
                type: "folder",
                name: folderName,
              });
            }
          }
        }
      });

      setQuizzes(data);
      setFolders(derivedFolders.filter((f) => f.name.toLowerCase() !== "root"));
    } catch (err) {
      console.error("❌ Failed to load quizzes:", err);
    }
  };

  // ✅ Load quizzes on mount
  useEffect(() => {
    fetchQuizzes();
  }, []);

  // ✅ Select/deselect helpers
  const handleSelectAll = () => {
    const allItems = [...folders, ...quizzes];
    setSelectedItems(allItems.map((i) => i.id));
  };

  const handleDeselectAll = () => setSelectedItems([]);

const handleDeleteSelected = async () => {
  try {
    // Filter only quizzes with numeric IDs (folders aren’t stored in DB)
    const quizIds = quizzes
      .filter((q) => selectedItems.includes(q.id))
      .map((q) => q.id);

    if (quizIds.length === 0) {
      // Only local folders selected — remove them from state
      setFolders((prev) => prev.filter((f) => !selectedItems.includes(f.id)));
      setSelectedItems([]);
      return;
    }

    const res = await fetch("/api/db/deleteQuiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: quizIds }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log(`🗑️ Deleted ${data.deleted} quiz(es)`);
      await fetchQuizzes(); // Refresh UI
    } else {
      console.error("❌ Delete failed:", data.error);
    }
  } catch (err) {
    console.error("❌ Error deleting quizzes:", err);
  } finally {
    setSelectedItems([]);
  }
};


  // ✅ Create new quiz using /api/db/createQuiz
  const handleCreateQuiz = async (quizName: string, description = "") => {
    try {
      const res = await fetch("/api/db/createQuiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizName,
          description,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`✅ Quiz created with ID: ${data.quizId}`);
        // 👇 Refresh quizzes from DB so generation_status = 'pending' appears
        await fetchQuizzes();
      } else {
        console.error("❌ Failed to create quiz:", data.error);
      }
    } catch (err) {
      console.error("❌ Error creating quiz:", err);
    } finally {
      setPopupOpen(false);
    }
  };

  // ✅ Local folder creation
  const handleCreateFolder = (folderName: string) => {
    if (!folderName.trim()) return;
    setFolders((prev) => [
      ...prev,
      { id: folderName, type: "folder", name: folderName },
    ]);
    setPopupOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative">
      <PageHeader
        title="Learning Space"
        icon={BookOpen}
        activeFolder={activeFolder}
        goBack={() => setActiveFolder(null)}
        selectedItems={selectedItems}
        onDeleteSelected={handleDeleteSelected}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
      />

      <main className="px-6 sm:px-20 pb-20">
        <GenericGrid
          items={[...folders, ...quizzes]}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          renderItem={(item, isSelected, onClick) => {
            if (item.type === "folder") {
              return (
                <div
                  onClick={onClick}
                  className={`p-6 bg-yellow-100 dark:bg-yellow-800 rounded-xl shadow text-center cursor-pointer hover:shadow-md ${
                    isSelected ? "ring-2 ring-yellow-500" : ""
                  }`}
                >
                  <h3 className="font-semibold">{item.name}</h3>
                </div>
              );
            }

            // ✅ Quiz Card
            return (
              <QuizCard
                quizName={item.name}
                selected={isSelected}
                onClick={onClick}
                onDoubleClick={() => {
                  if (item.id) {
                    sessionStorage.setItem("selectedQuizId", String(item.id));
                  }
                  if (item.name) {
                    router.push(`/quizDetails/${encodeURIComponent(item.name)}`);
                  }
                }}
              />
            );
          }}
        />
      </main>

      {/* Floating Add Button */}
      <FloatingAddButton onClick={() => setPopupOpen(true)} />

      {/* Create Quiz/Folder Popup */}
      <CreateItemPopup
        isOpen={isPopupOpen}
        onClose={() => setPopupOpen(false)}
        onCreateQuiz={handleCreateQuiz}
        onCreateFolder={handleCreateFolder}
      />
    </div>
  );
}
