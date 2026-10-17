"use client";
import { apiFetch } from "@/lib/api";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import GenericGrid from "@/components/GenericGrid";
import FloatingAddButton from "@/components/FloatingAddButton";
import GenericActionPopup from "@/components/GenericActionPopup";
import CreateQuizPopup from "@/components/CreateQuizPopup";
import CreateFolderPopup from "@/components/CreateFolderPopup";
import QuizCard from "@/components/QuizCard";
import FolderCard from "@/components/FolderCard";
import AlertPopup from "@/components/AlertPopup";
import { Item } from "@/types/Item";
import {
  BookOpen,
  BookPlus,
  FolderPlus,
  MoveRight,
  Trash2,
  Folder,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import EmptyState, { SkeletonGrid } from "@/components/ui/EmptyState";
import { useRouter } from "next/navigation";

type FolderCrumb = { id: string | null; name: string };

export default function LearningSpace() {
  const [folders, setFolders] = useState<Item[]>([]);
  const [quizzes, setQuizzes] = useState<Item[]>([]);
  const [displayItems, setDisplayItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeFolderName, setActiveFolderName] = useState<string>("Learning Space");
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([]);

  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const router = useRouter();

  /* ---------------- Load persisted folder state ---------------- */
  useEffect(() => {
    const savedId = sessionStorage.getItem("quizActiveFolderId");
    const savedName = sessionStorage.getItem("quizActiveFolderName");
    const savedStack = sessionStorage.getItem("quizFolderStack");

    if (savedId !== null) setActiveFolderId(savedId === "null" ? null : savedId);
    if (savedName) setActiveFolderName(savedName);
    if (savedStack) setFolderStack(JSON.parse(savedStack));
  }, []);

  /* ---------------- Persist folder state ---------------- */
  useEffect(() => {
    sessionStorage.setItem("quizActiveFolderId", String(activeFolderId));
    sessionStorage.setItem("quizActiveFolderName", activeFolderName);
    sessionStorage.setItem("quizFolderStack", JSON.stringify(folderStack));
  }, [activeFolderId, activeFolderName, folderStack]);

  /* ---------------- Fetch Folders ---------------- */
  const fetchFolders = async (parentId: string | null) => {
    const res = await apiFetch(
      `/api/items/folders?parent=${parentId ?? "root"}&context=quizzes`,
      { cache: "no-store" }
    );
    const data = await res.json();
    const mapped: Item[] = data.map((f: any) => ({
      id: f.id.toString(),
      name: f.name,
      type: "folder",
      itemCount: f.itemCount ?? 0,
      parent_id: f.parent_id ? f.parent_id.toString() : null,
    }));
    setFolders(mapped);
    return mapped;
  };

  /* ---------------- Fetch Quizzes (with score) ---------------- */
  const fetchQuizzes = async (folderId: string | null) => {
    const res = await apiFetch(`/api/items/quizzes/getAll?folder=${folderId ?? "root"}`, {
      cache: "no-store",
    });
    const data = await res.json();
    const mapped: Item[] = data.map((q: any) => ({
      id: q.id.toString(),
      name: q.name,
      type: "quiz",
      folder_id: q.folder_id ? q.folder_id.toString() : null,
      description: q.description ?? "",
      last_score: q.last_score ?? null,
      generation_status: q.generation_status ?? null,
      question_count: q.questions?.length ?? 0,
    }));
    setQuizzes(mapped);
    return mapped;
  };

  /* ---------------- Refresh ---------------- */
  const refreshData = async (folderId: string | null = activeFolderId) => {
    const [folderData, quizData] = await Promise.all([
      fetchFolders(folderId),
      fetchQuizzes(folderId),
    ]);
    setDisplayItems([...folderData, ...quizData]);
    setLoaded(true);
  };

  useEffect(() => {
    refreshData(activeFolderId);
  }, [activeFolderId]);

  /* ---------------- Folder Navigation ---------------- */
  const handleDoubleClick = (item: Item) => {
    if (item.type === "folder") {
      const currentCrumb: FolderCrumb = { id: activeFolderId, name: activeFolderName };
      setFolderStack((prev) => [...prev, currentCrumb]);
      setActiveFolderId(item.id);
      setActiveFolderName(item.name);
    } else if (item.type === "quiz") {
      sessionStorage.setItem("selectedQuizId", String(item.id));
      router.push(`/quizDetails/${encodeURIComponent(item.name)}`);
    }
  };

  const handleGoBack = () => {
    if (folderStack.length > 0) {
      const prevStack = [...folderStack];
      const last = prevStack.pop()!;
      setFolderStack(prevStack);
      setActiveFolderId(last.id);
      setActiveFolderName(last.name || "Learning Space");
    } else {
      setActiveFolderId(null);
      setActiveFolderName("Learning Space");
    }
  };

  /* ---------------- Folder Rename ---------------- */
  const handleRenameFolder = async (newName: string) => {
    if (!activeFolderId) return;
    try {
      const res = await apiFetch(`/api/items/folders/rename/${activeFolderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, context: "quizzes" }),
      });

      if (!res.ok) {
        const err = await res.json();
        setAlertMessage(err.error || "Rename failed.");
        return;
      }

      const data = await res.json();
      setActiveFolderName(data.name);
      await refreshData(activeFolderId);
    } catch {
      setAlertMessage("Rename failed. Please try again.");
    }
  };

  /* ---------------- Folder Create ---------------- */
  const handleCreateFolder = async (name: string) => {
    await apiFetch("/api/items/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: activeFolderId, context: "quizzes" }),
    });
    await refreshData(activeFolderId);
    setIsCreateFolderOpen(false);
  };

  /* ---------------- Quiz Create ---------------- */
const handleCreateQuiz = async (quizName: string, description?: string) => {
  try {
    const res = await apiFetch("/api/items/quizzes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: quizName, description, folder_id: activeFolderId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("❌ [CreateQuiz] Failed:", err);
      setAlertMessage(
        err?.error
          ? `Error: ${err.error}\n${err.details ? "Details: " + err.details : ""}`
          : `Unknown error (${res.status})`
      );
      return;
    }

    const data = await res.json();
    console.log("✅ [CreateQuiz] Success:", data);
    await refreshData(activeFolderId);
    setIsCreateQuizOpen(false);
  } catch (err: any) {
    console.error("❌ [CreateQuiz] Network or runtime error:", err);
    setAlertMessage(`Network error: ${err.message}`);
  }
};


  /* ---------------- Drag → Drop onto folder ---------------- */
  const handleDropOnFolder = async (source: Item | Item[], destinationFolderId: string) => {
    try {
      const sources = Array.isArray(source) ? source : [source];
      for (const s of sources) {
        if (s.type === "quiz") {
          await apiFetch(`/api/items/quizzes/move/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder_id: destinationFolderId }),
          });
        } else if (s.type === "folder" && s.id !== destinationFolderId) {
          await apiFetch(`/api/items/folders/move/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parent_id: destinationFolderId, context: "quizzes" }),
          });
        }
      }
      await refreshData(activeFolderId);
    } catch {
      setAlertMessage("Move failed. Please try again.");
    }
  };

  /* ---------------- Drop onto “move to parent” bar ---------------- */
  const handleDropToParent = async (source: Item | Item[]) => {
    try {
      const sources = Array.isArray(source) ? source : [source];
      if (!activeFolderId) {
        setAlertMessage("Already at root — cannot move higher.");
        return;
      }

      const currentFolder = folders.find((f) => f.id === activeFolderId);
      const parentId = currentFolder?.parent_id ?? null;

      for (const s of sources) {
        if (s.type === "quiz") {
          await apiFetch(`/api/items/quizzes/move/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder_id: parentId }),
          });
        } else if (s.type === "folder") {
          if (s.id === parentId) continue;
          await apiFetch(`/api/items/folders/move/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parent_id: parentId, context: "quizzes" }),
          });
        }
      }

      await refreshData(activeFolderId);
    } catch {
      setAlertMessage("Failed to move item(s) to parent folder.");
    }
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

    if (quizIds.length)
      await apiFetch("/api/items/quizzes/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: quizIds }),
      });
    if (folderIds.length)
      await apiFetch("/api/items/folders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: folderIds, context: "quizzes" }),
      });

    setSelectedItems([]);
    await refreshData(activeFolderId);
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="page flex flex-col">
      <PageHeader
        title={activeFolderName}
        icon={activeFolderId ? Folder : BookOpen} // 🟢 Dynamically switch icon
        color={activeFolderId ? "yellow" : "blue"}
        goBack={handleGoBack}
        showBack={folderStack.length > 0 || !!activeFolderId}
        activeFolder={activeFolderName}
        canRename={!!activeFolderId} // rename only when inside folder
        onRename={handleRenameFolder}
        selectedItems={selectedItems}
        onSelectAll={() => setSelectedItems(displayItems.map((i) => i.id))}
        onDeselectAll={() => setSelectedItems([])}
        extraActions={[
          {
            icon: Trash2,
            label: "Delete",
            color: "red",
            onClick: () => setConfirmDelete(true),
            disabled: !selectedItems.length,
          },
        ]}
      />

      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 pb-28">
        <GenericGrid
          items={displayItems}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          onDropOnFolder={handleDropOnFolder}
          onDropToParent={handleDropToParent}
          onOpen={handleDoubleClick}
          emptyState={
            !loaded ? (
              <SkeletonGrid />
            ) : (
            <EmptyState
              icon={activeFolderId ? FolderOpen : Sparkles}
              title={activeFolderId ? "This folder is empty" : "Create your first study set"}
              text="A study set turns your notes into questions, flashcards, a matching game and a study guide. Give it a name, add your files, and let the AI do the rest."
              action="New study set"
              onAction={() => setIsCreateQuizOpen(true)}
            />
            )
          }
          renderItem={(item, isSelected, onClick) =>
            item.type === "folder" ? (
              <FolderCard
                folderName={item.name}
                itemCount={item.itemCount || 0}
                selected={isSelected}
                onClick={onClick}
                onDoubleClick={() => handleDoubleClick(item)}
              />
            ) : (
              <QuizCard
                quizName={item.name}
                description={item.description}
                lastScore={item.last_score ?? null}
                status={item.generation_status}
                questionCount={item.question_count ?? 0}
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
        title="Create"
        actions={[
          {
            key: "quiz",
            title: "New study set",
            subtitle: "Quizzes, flashcards and more from your notes",
            color: "blue",
            icon: BookPlus,
            onClick: () => setIsCreateQuizOpen(true),
          },
          {
            key: "folder",
            title: "New folder",
            subtitle: "Keep your study sets organised",
            color: "yellow",
            icon: FolderPlus,
            onClick: () => setIsCreateFolderOpen(true),
          },
        ]}
      />

      <CreateQuizPopup
        isOpen={isCreateQuizOpen}
        onClose={() => setIsCreateQuizOpen(false)}
        onCreateQuiz={handleCreateQuiz}
      />

      <CreateFolderPopup
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      {alertMessage && (
        <AlertPopup message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      {confirmDelete && (
  <AlertPopup
    message={`Delete ${selectedItems.length} item(s)? This cannot be undone.`}
    onClose={() => setConfirmDelete(false)} // close without deleting
    actions={[
      {
        label: "Cancel",
        color: "gray",
        onClick: () => setConfirmDelete(false),
      },
      {
        label: "Delete",
        color: "red",
        onClick: confirmDeleteAction,
      },
    ]}
  />
)}

    </div>
  );
}
