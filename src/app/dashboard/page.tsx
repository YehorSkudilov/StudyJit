"use client";

import React, { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import GenericGrid from "@/components/GenericGrid";
import FloatingAddButton from "@/components/FloatingAddButton";
import GenericActionPopup from "@/components/GenericActionPopup";
import CreateQuizPopup from "@/components/CreateQuizPopup";
import CreateFolderPopup from "@/components/CreateFolderPopup";
import QuizCard from "@/components/QuizCard";
import { Item } from "@/types/Item";
import { BookOpen, BookPlus, FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Item[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Popup states
  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  const router = useRouter();

  /* ---------------- Fetch Quizzes ---------------- */
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

  useEffect(() => {
    fetchQuizzes();
  }, []);

  /* ---------------- Selection Helpers ---------------- */
  const handleSelectAll = () => {
    const allItems = [...folders, ...quizzes];
    setSelectedItems(allItems.map((i) => i.id));
  };

  const handleDeselectAll = () => setSelectedItems([]);

  /* ---------------- Delete Selected ---------------- */
  const handleDeleteSelected = async () => {
    try {
      const quizIds = quizzes
        .filter((q) => selectedItems.includes(q.id))
        .map((q) => q.id);

      if (quizIds.length === 0) {
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
        await fetchQuizzes();
      } else {
        console.error("❌ Delete failed:", data.error);
      }
    } catch (err) {
      console.error("❌ Error deleting quizzes:", err);
    } finally {
      setSelectedItems([]);
    }
  };

  /* ---------------- Create Quiz ---------------- */
  const handleCreateQuiz = async (quizName: string, description = "") => {
    try {
      if (!quizName.trim()) return;

      const res = await fetch("/api/db/createQuiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quizName.trim(),
          description,
          prompt: "",
          numQuestions: 10,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        console.log(`✅ Quiz created with ID: ${data.quizId}`);
        await fetchQuizzes();
      } else {
        console.error("❌ Failed to create quiz:", data.error);
      }
    } catch (err) {
      console.error("❌ Error creating quiz:", err);
    } finally {
      setIsCreateQuizOpen(false);
    }
  };

  /* ---------------- Create Folder ---------------- */
  const handleCreateFolder = (folderName: string) => {
    if (!folderName.trim()) return;
    setFolders((prev) => [
      ...prev,
      { id: folderName, type: "folder", name: folderName },
    ]);
    setIsCreateFolderOpen(false);
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative">
      {/* Header */}
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

      {/* Main Grid */}
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
      <FloatingAddButton onClick={() => setIsActionChooserOpen(true)} />

      {/* Action Chooser Popup */}
      <GenericActionPopup
        isOpen={isActionChooserOpen}
        onClose={() => setIsActionChooserOpen(false)}
        title="Create New Item"
        actions={[
          {
            key: "quiz",
            title: "Create Quiz",
            subtitle: "Generate a new quiz",
            color: "blue",
            icon: BookPlus,
            onClick: () => setIsCreateQuizOpen(true),
          },
          {
            key: "folder",
            title: "Create Folder",
            subtitle: "Organize your quizzes",
            color: "yellow",
            icon: FolderPlus,
            onClick: () => setIsCreateFolderOpen(true),
          },
        ]}
      />

      {/* Create Quiz Popup */}
      <CreateQuizPopup
        isOpen={isCreateQuizOpen}
        onClose={() => setIsCreateQuizOpen(false)}
        onCreateQuiz={handleCreateQuiz}
      />

      {/* Create Folder Popup */}
      <CreateFolderPopup
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />
    </div>
  );
}
