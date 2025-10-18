"use client";
import React, { useState, useEffect } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import GenericGrid from "@/components/GenericGrid";
import FloatingAddButton from "@/components/FloatingAddButton";
import CreateItemPopup from "@/components/CreateItemPopup";
import QuizCard from "@/components/QuizCard"; // ✅ Import QuizCard

type Item = {
  id: string;
  type: "folder" | "quiz" | "other";
  name: string;
  description?: string;
  generation_status?: "pending" | "success" | "failed" | null;
};

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Item[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isPopupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const res = await fetch("/api/db/getQuizzes");
        const data = await res.json();
        console.log("✅ API returned:", data);

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

    fetchQuizzes();
  }, []);

  const handleSelectAll = () => {
    const allItems = [...folders, ...quizzes];
    setSelectedItems(allItems.map((i) => i.id));
  };

  const handleDeselectAll = () => setSelectedItems([]);

  const handleDeleteSelected = () => {
    setQuizzes((prev) => prev.filter((q) => !selectedItems.includes(q.id)));
    setFolders((prev) => prev.filter((f) => !selectedItems.includes(f.id)));
    setSelectedItems([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative">
      <DashboardHeader
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

            // ✅ Use QuizCard here instead of plain text
            return (
              <QuizCard
                quizName={item.name}
                selected={isSelected}
                onClick={onClick}
                onDoubleClick={() =>
                  console.log(`Double-clicked quiz: ${item.name}`)
                }
              />
            );
          }}
        />
      </main>

      <FloatingAddButton onClick={() => setPopupOpen(true)} />
      <CreateItemPopup
        isOpen={isPopupOpen}
        onClose={() => setPopupOpen(false)}
        onCreateQuiz={() => {}}
        onCreateFolder={() => {}}
      />
    </div>
  );
}
