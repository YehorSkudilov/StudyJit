"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import GenericGrid from "@/components/GenericGrid";
import FileCard from "@/components/FileCard";
import FolderCard from "@/components/FolderCard";
import FloatingAddButton from "@/components/FloatingAddButton";
import FileUploadPopup from "@/components/FileUploadPopup";
import CreateFolderPopup from "@/components/CreateFolderPopup";
import MoveItemPopup from "@/components/MoveItemPopup";
import GenericActionPopup from "@/components/GenericActionPopup";
import AlertPopup from "@/components/AlertPopup";
import { Item } from "@/types/Item";
import { File, FilePlus, FolderPlus, MoveRight, Trash2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                               FILES PAGE                                   */
/* -------------------------------------------------------------------------- */
export default function FilesPage() {
  const [folders, setFolders] = useState<Item[]>([]);
  const [files, setFiles] = useState<Item[]>([]);
  const [displayItems, setDisplayItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isMovePopupOpen, setIsMovePopupOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

/* ---------------- Fetch Folders ---------------- */
  const fetchFolders = async (parentId: string | null) => {
    try {
      type FolderResponse = {
        id: number;
        name: string;
        itemCount?: number;
        parent_id?: number | null;
      };

      const res = await fetch(
        `/api/items/folders?parent=${parentId ?? "root"}&context=files`,
        { cache: "no-store" }
      );
      const data: FolderResponse[] = await res.json();

      const mapped = data.map((f: FolderResponse): Item => ({
        id: f.id.toString(),
        name: f.name,
        type: "folder",
        itemCount: f.itemCount ?? 0,
        parent_id: f.parent_id ? f.parent_id.toString() : null,
      }));
      setFolders(mapped);
      return mapped;
    } catch (err) {
      console.error("❌ Folder fetch error:", err);
      setAlertMessage("Failed to fetch folders.");
      return [];
    }
  };

  /* ---------------- Fetch Files ---------------- */
  const fetchFiles = async () => {
    try {
      type FileResponse = {
        id: number;
        name: string;
        folder_id?: number | null;
        size?: number;
      };

      const res = await fetch(`/api/items/files`, { cache: "no-store" });
      const data: FileResponse[] = await res.json();

      const mapped = data.map((f: FileResponse): Item => ({
        id: f.id.toString(),
        name: f.name,
        type: "file",
        folder_id: f.folder_id ? f.folder_id.toString() : null,
        size: f.size ?? 0,
      }));
      setFiles(mapped);
      return mapped;
    } catch (err) {
      console.error("❌ File fetch error:", err);
      setAlertMessage("Failed to fetch files.");
      return [];
    }
  };

  /* ---------------- Refresh ---------------- */
  const refreshData = async (folderId: string | null = activeFolderId) => {
    try {
      const [folderData, allFiles] = await Promise.all([
        fetchFolders(folderId),
        fetchFiles(),
      ]);

      // ✅ Only show files that belong to the current folder
      const visibleFiles = allFiles.filter((f) =>
        folderId === null ? f.folder_id === null : f.folder_id === folderId
      );

      setDisplayItems([...folderData, ...visibleFiles]);
    } catch {
      setAlertMessage("Error refreshing files.");
    }
  };

  useEffect(() => {
    refreshData(activeFolderId);
  }, [activeFolderId]);

  /* ---------------- Folder Navigation ---------------- */
  const handleDoubleClick = (item: Item) => {
    if (item.type === "folder") setActiveFolderId(item.id);
    else console.log(`📂 Opened file: ${item.name}`);
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
      body: JSON.stringify({ name, parent_id: activeFolderId, context: "files" }),
    });
    await refreshData(activeFolderId);
    setIsCreateFolderOpen(false);
  };

  /* ---------------- File Upload (chunked) ---------------- */
  const handleFileUpload = async (file: File, onProgress?: (p: number) => void) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    let start = 0;

    while (start < file.size) {
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const res = await fetch("/api/items/files/upload", {
        method: "POST",
        headers: {
          "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
          "X-Filename": encodeURIComponent(file.name),
          "X-Folder": activeFolderId ?? "root",
        },
        body: chunk,
      });

      if (!res.ok) throw new Error("Chunk upload failed");
      start = end;
      onProgress?.(Math.round((end / file.size) * 100));
    }

    await refreshData(activeFolderId);
  };

  /* ---------------- Move ---------------- */
  const handleMoveItems = async (newFolderId: string | null) => {
    for (const id of selectedItems) {
      const item = displayItems.find((i) => i.id === id);
      if (!item) continue;

      if (item.type === "file") {
        await fetch(`/api/items/files/move/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder_id: newFolderId }),
        });
      } else if (item.type === "folder") {
        await fetch(`/api/items/folders/move/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: newFolderId, context: "files" }),
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
    const fileIds = displayItems
      .filter((i) => i.type === "file" && selectedItems.includes(i.id))
      .map((f) => f.id);

    if (fileIds.length > 0) {
      await fetch("/api/items/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: fileIds }),
      });
    }
    if (folderIds.length > 0) {
      await fetch("/api/items/folders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: folderIds, context: "files" }),
      });
    }
    setSelectedItems([]);
    await refreshData(activeFolderId);
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title="Files"
        icon={File}
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
              <FolderCard
                folderName={item.name}
                itemCount={item.itemCount || 0}
                selected={isSelected}
                onClick={onClick}
                onDoubleClick={() => handleDoubleClick(item)}
              />
            ) : (
              <FileCard
                fileName={item.name}
                fileSize={item.size}
                selected={isSelected}
                onClick={onClick}
                onDoubleClick={() => handleDoubleClick(item)}
              />
            )
          }
        />
      </main>

      {/* Floating Add */}
      <FloatingAddButton onClick={() => setIsActionChooserOpen(true)} />
      <GenericActionPopup
        isOpen={isActionChooserOpen}
        onClose={() => setIsActionChooserOpen(false)}
        title="Create New"
        actions={[
          { key: "upload", title: "Upload File", subtitle: "Upload to current folder", color: "blue", icon: FilePlus, onClick: () => setIsFileUploadOpen(true) },
          { key: "folder", title: "Create Folder", subtitle: "Organize files", color: "yellow", icon: FolderPlus, onClick: () => setIsCreateFolderOpen(true) },
        ]}
      />

      {/* Popups */}
      <FileUploadPopup isOpen={isFileUploadOpen} onClose={() => setIsFileUploadOpen(false)} onFileUpload={handleFileUpload} />
      <CreateFolderPopup isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} onCreateFolder={handleCreateFolder} />
<MoveItemPopup
  isOpen={isMovePopupOpen}
  onClose={() => setIsMovePopupOpen(false)}
  folders={folders.map((f: Item) => ({
    id: f.id.toString(),
    name: f.name,
    parent_id: (f as any).parent_id ?? null,
  }))}
  onMove={handleMoveItems}
  showRoot={
    // ✅ show Root only if at least one selected item is NOT in root
    selectedItems.some((id) => {
      const item = displayItems.find((i) => i.id === id);
      if (!item) return false;
      if (item.type === "folder") return item.parent_id !== null;
      if (item.type === "file") return item.folder_id !== null;
      return false;
    })
  }
/>



      {/* Alerts */}
      {alertMessage && <AlertPopup message={alertMessage} onClose={() => setAlertMessage(null)} />}
      {confirmDelete && (
        <AlertPopup
          message={`Delete ${selectedItems.length} item(s)? This cannot be undone.`}
          onClose={confirmDeleteAction}
        />
      )}
    </div>
  );
}
