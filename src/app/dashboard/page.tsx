"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import GenericGrid from "@/components/GenericGrid";
import FloatingAddButton from "@/components/FloatingAddButton";
import GenericActionPopup from "@/components/GenericActionPopup";
import CreateQuizPopup from "@/components/CreateQuizPopup";
import CreateFolderPopup from "@/components/CreateFolderPopup";
import MoveItemPopup from "@/components/MoveItemPopup";
import QuizCard from "@/components/QuizCard";
import { Item } from "@/types/Item";
import { BookOpen, BookPlus, FolderPlus, MoveRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [allQuizzes, setAllQuizzes] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Item[]>([]);
  const [displayItems, setDisplayItems] = useState<Item[]>([]);
  const [activePath, setActivePath] = useState<string>("root");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isMovePopupOpen, setIsMovePopupOpen] = useState(false);

  const router = useRouter();

  /* ---------------- Fetch Folders ---------------- */
  const fetchFolders = async (path: string) => {
    const res = await fetch(`/api/db/folders?path=${path}`, { cache: "no-store" });
    const data = await res.json();
    const mapped = data.map((f: any) => ({
      id: `folder-${f.full_path}`,
      name: f.name,
      type: "folder" as const,
      itemCount: 0,
      full_path: f.full_path,
    }));
    setFolders(mapped);
    return mapped;
  };

  /* ---------------- Fetch Quizzes ---------------- */
  const fetchQuizzes = async (path: string) => {
    const res = await fetch("/api/db/getQuizzes", { cache: "no-store" });
    const data = await res.json();
    setAllQuizzes(data);
    return data;
  };

  const refreshData = async (path: string = activePath) => {
    const [foldersData, quizzesData] = await Promise.all([
      fetchFolders(path),
      fetchQuizzes(path),
    ]);
    const quizzesInFolder = quizzesData.filter((q: any) => q.folder_path === path);
    setDisplayItems([...foldersData, ...quizzesInFolder.map((q: any) => ({ ...q, type: "quiz" }))]);
  };

  useEffect(() => {
    refreshData(activePath);
  }, [activePath]);

  /* ---------------- Folder Navigation ---------------- */
  const handleDoubleClick = (item: Item) => {
    if (item.type === "folder") {
      setActivePath(item.full_path || item.id.replace("folder-", ""));
    } else {
      router.push(`/quizDetails/${encodeURIComponent(item.name)}`);
    }
  };

  const handleGoBack = () => {
    if (activePath === "root") return;
    const parent = activePath.split("/").slice(0, -1).join("/") || "root";
    setActivePath(parent);
  };

  /* ---------------- Create Folder ---------------- */
  const handleCreateFolder = async (name: string) => {
    await fetch("/api/db/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_path: activePath }),
    });
    await refreshData(activePath);
    setIsCreateFolderOpen(false);
  };

  /* ---------------- Move Quizzes ---------------- */
  const handleMoveItems = async (newFolderPath: string) => {
    for (const id of selectedItems) {
      const [type, realId] = id.split("-");
      if (type !== "quiz") continue;
      await fetch(`/api/db/quizzes/move/${realId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_path: newFolderPath }),
      });
    }
    setSelectedItems([]);
    await refreshData(activePath);
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title="Learning Space"
        icon={BookOpen}
        activeFolder={activePath === "root" ? null : activePath}
        goBack={handleGoBack}
        selectedItems={selectedItems}
        onSelectAll={() => setSelectedItems(displayItems.map((i) => i.id))}
        onDeselectAll={() => setSelectedItems([])}
        extraActions={[
          {
            icon: MoveRight,
            label: "Move",
            onClick: () => setIsMovePopupOpen(true),
            disabled: selectedItems.length === 0,
          },
        ]}
      />

      <main className="px-6 sm:px-20 pb-20">
        <GenericGrid
          items={displayItems}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          renderItem={(item, isSelected, onClick) =>
            item.type === "folder" ? (
              <div
                onClick={onClick}
                onDoubleClick={() => handleDoubleClick(item)}
                className={`p-6 bg-yellow-100 dark:bg-yellow-800 rounded-xl shadow text-center cursor-pointer hover:shadow-md ${
                  isSelected ? "ring-2 ring-yellow-500" : ""
                }`}
              >
                <h3 className="font-semibold">{item.name}</h3>
              </div>
            ) : (
              <QuizCard
                quizName={item.name}
                selected={isSelected}
                onClick={onClick}
                onDoubleClick={() => handleDoubleClick(item)}
              />
            )
          }
        />
      </main>

      <FloatingAddButton onClick={() => setIsActionChooserOpen(true)} />

      <GenericActionPopup
        isOpen={isActionChooserOpen}
        onClose={() => setIsActionChooserOpen(false)}
        title="Create New"
        actions={[
          {
            key: "quiz",
            title: "Create Quiz",
            subtitle: "Add new quiz",
            color: "blue",
            icon: BookPlus,
            onClick: () => setIsCreateQuizOpen(true),
          },
          {
            key: "folder",
            title: "Create Folder",
            subtitle: "Organize quizzes",
            color: "yellow",
            icon: FolderPlus,
            onClick: () => setIsCreateFolderOpen(true),
          },
        ]}
      />

      <CreateQuizPopup
        isOpen={isCreateQuizOpen}
        onClose={() => setIsCreateQuizOpen(false)}
        onCreateQuiz={() => {}}
      />

      <CreateFolderPopup
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      <MoveItemPopup
        isOpen={isMovePopupOpen}
        onClose={() => setIsMovePopupOpen(false)}
        folders={folders.map((f) => f.full_path)}
        onMove={handleMoveItems}
      />
    </div>
  );
}
