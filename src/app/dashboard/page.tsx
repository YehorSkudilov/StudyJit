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
import FolderCard from "@/components/FolderCard";
import AlertPopup from "@/components/AlertPopup";
import { Item } from "@/types/Item";
import { BookOpen, BookPlus, FolderPlus, MoveRight, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [folders, setFolders] = useState<Item[]>([]);
  const [quizzes, setQuizzes] = useState<Item[]>([]);
  const [displayItems, setDisplayItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isMovePopupOpen, setIsMovePopupOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const router = useRouter();

  /* ---------------- Fetch Folders ---------------- */
  const fetchFolders = async (parentId: string | null) => {
    try {
      const res = await fetch(
        `/api/items/folders?parent=${parentId ?? "root"}&context=quizzes`,
        { cache: "no-store" }
      );
      const data = await res.json();

      const mapped = data.map((f: any) => ({
        id: f.id.toString(),
        name: f.name,
        type: "folder" as const,
        itemCount: f.itemCount ?? 0,
        parent_id: f.parent_id ? f.parent_id.toString() : null,
      }));
      setFolders(mapped);
      return mapped;
    } catch (err) {
      console.error("❌ Folder fetch error:", err);
      setAlertMessage("Failed to fetch quiz folders.");
      return [];
    }
  };

  /* ---------------- Fetch Quizzes ---------------- */
  const fetchQuizzes = async (folderId: string | null) => {
    try {
      const res = await fetch(
        `/api/items/quizzes/getAll?folder=${folderId ?? "root"}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const mapped = data.map((q: any) => ({
        id: q.id.toString(),
        name: q.name,
        type: "quiz" as const,
        folder_id: q.folder_id ? q.folder_id.toString() : null,
      }));
      setQuizzes(mapped);
      return mapped;
    } catch (err) {
      console.error("❌ Quiz fetch error:", err);
      setAlertMessage("Failed to fetch quizzes.");
      return [];
    }
  };

  /* ---------------- Refresh ---------------- */
  const refreshData = async (folderId: string | null = activeFolderId) => {
    try {
      const [folderData, quizData] = await Promise.all([
        fetchFolders(folderId),
        fetchQuizzes(folderId),
      ]);
      setDisplayItems([...folderData, ...quizData]);
    } catch {
      setAlertMessage("Error refreshing quizzes.");
    }
  };

  useEffect(() => {
    refreshData(activeFolderId);
  }, [activeFolderId]);

  /* ---------------- Folder Navigation ---------------- */
const handleDoubleClick = (item: Item) => {
  if (item.type === "folder") {
    setActiveFolderId(item.id);
  } else if (item.type === "quiz") {
    sessionStorage.setItem("selectedQuizId", String(item.id));

    // ✅ Navigate to details page
    router.push(`/quizDetails/${encodeURIComponent(item.name)}`);
  }
};


  const handleGoBack = () => {
    const currentFolder = folders.find((f) => f.id === activeFolderId);
    setActiveFolderId(currentFolder?.parent_id ?? null);
  };

  /* ---------------- Folder Create ---------------- */
  const handleCreateFolder = async (name: string) => {
    await fetch("/api/items/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: activeFolderId, context: "quizzes" }),
    });
    await refreshData(activeFolderId);
    setIsCreateFolderOpen(false);
  };

  /* ---------------- Quiz Create ---------------- */
  const handleCreateQuiz = async (quizName: string, description?: string) => {
    await fetch("/api/items/quizzes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: quizName, description, folder_id: activeFolderId }),
    });
    await refreshData(activeFolderId);
    setIsCreateQuizOpen(false);
  };

  /* ---------------- Move ---------------- */
  const handleMoveItems = async (newFolderId: string | null) => {
    for (const id of selectedItems) {
      const item = displayItems.find((i) => i.id === id);
      if (!item) continue;

      if (item.type === "quiz") {
        await fetch(`/api/items/quizzes/move/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder_id: newFolderId }),
        });
      } else if (item.type === "folder") {
        await fetch(`/api/items/folders/move/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: newFolderId, context: "quizzes" }),
        });
      }
    }
    setSelectedItems([]);
    await refreshData(activeFolderId);
  };

  /* ---------------- Delete ---------------- */
  const confirmDeleteAction = async () => {
    setConfirmDelete(false);
    const folderIds = displayItems
      .filter((i) => i.type === "folder" && selectedItems.includes(i.id))
      .map((f) => f.id);
    const quizIds = displayItems
      .filter((i) => i.type === "quiz" && selectedItems.includes(i.id))
      .map((q) => q.id);

    if (quizIds.length > 0) {
      await fetch("/api/items/quizzes/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: quizIds }),
      });
    }
    if (folderIds.length > 0) {
      await fetch("/api/items/folders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: folderIds, context: "quizzes" }),
      });
    }
    setSelectedItems([]);
    await refreshData(activeFolderId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title="Learning Space"
        icon={BookOpen}
        activeFolder={activeFolderId}
        goBack={handleGoBack}
        selectedItems={selectedItems}
        onSelectAll={() => setSelectedItems(displayItems.map((i) => i.id))}
        onDeselectAll={() => setSelectedItems([])}
        extraActions={[
          { icon: MoveRight, label: "Move", onClick: () => setIsMovePopupOpen(true), disabled: !selectedItems.length },
          { icon: Trash2, label: "Delete", color: "red", onClick: () => setConfirmDelete(true), disabled: !selectedItems.length },
        ]}
      />

      <main className="px-6 sm:px-20 pb-20">
        <GenericGrid
          items={displayItems}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          renderItem={(item, isSelected, onClick) =>
            item.type === "folder" ? (
              <FolderCard folderName={item.name} itemCount={item.itemCount || 0} selected={isSelected} onClick={onClick} onDoubleClick={() => handleDoubleClick(item)} />
            ) : (
              <QuizCard quizName={item.name} selected={isSelected} onClick={onClick} onDoubleClick={() => handleDoubleClick(item)} />
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
          { key: "quiz", title: "Create Quiz", subtitle: "Add new quiz", color: "blue", icon: BookPlus, onClick: () => setIsCreateQuizOpen(true) },
          { key: "folder", title: "Create Folder", subtitle: "Organize quizzes", color: "yellow", icon: FolderPlus, onClick: () => setIsCreateFolderOpen(true) },
        ]}
      />
      <CreateQuizPopup isOpen={isCreateQuizOpen} onClose={() => setIsCreateQuizOpen(false)} onCreateQuiz={handleCreateQuiz} />
      <CreateFolderPopup isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} onCreateFolder={handleCreateFolder} />

<MoveItemPopup
  isOpen={isMovePopupOpen}
  onClose={() => setIsMovePopupOpen(false)}
  folders={folders.map((f) => ({
    id: f.id.toString(),
    name: f.name,
    parent_id: f.parent_id ?? null, // ✅ ensures correct type for FolderNode
  }))}
  onMove={handleMoveItems}
  showRoot={
    !displayItems.some(
      (i) =>
        selectedItems.includes(i.id) &&
        ((i.type === "folder" && (i as any).parent_id === null) ||
         (i.type === "quiz" && (i as any).folder_id === null))
    )
  }
/>
      {alertMessage && <AlertPopup message={alertMessage} onClose={() => setAlertMessage(null)} />}
      {confirmDelete && <AlertPopup message={`Delete ${selectedItems.length} item(s)? This cannot be undone.`} onClose={confirmDeleteAction} />}
    </div>
  );
}
