"use client";
import React, { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import GenericGrid from "@/components/GenericGrid";
import FileCard from "@/components/FileCard";
import FolderCard from "@/components/FolderCard";
import FloatingAddButton from "@/components/FloatingAddButton";
import FileUploadPopup from "@/components/FileUploadPopup";
import CreateFolderPopup from "@/components/CreateFolderPopup";
import GenericActionPopup from "@/components/GenericActionPopup";
import AlertPopup from "@/components/AlertPopup";
import { Item } from "@/types/Item";
import { File as FileIcon, FilePlus, FolderPlus, MoveRight, Trash2 } from "lucide-react";

export default function FilesPage() {
  const [folders, setFolders] = useState<Item[]>([]);
  const [files, setFiles] = useState<Item[]>([]);
  const [displayItems, setDisplayItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<string[]>([]); // 🟢 Navigation stack

  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* ---------------- Fetch Folders ---------------- */
  const fetchFolders = async (parentId: string | null) => {
    const res = await fetch(`/api/items/folders?parent=${parentId ?? "root"}&context=files`);
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

  /* ---------------- Fetch Files ---------------- */
  const fetchFiles = async () => {
    const res = await fetch(`/api/items/files`);
    const data = await res.json();
    const mapped: Item[] = data.map((f: any) => ({
      id: f.id.toString(),
      name: f.name,
      type: "file",
      folder_id: f.folder_id ? f.folder_id.toString() : null,
      size: f.size ?? 0,
    }));
    setFiles(mapped);
    return mapped;
  };

  /* ---------------- Refresh ---------------- */
  const refreshData = async (folderId: string | null = activeFolderId) => {
    const [folderData, allFiles] = await Promise.all([fetchFolders(folderId), fetchFiles()]);
    const visibleFiles = allFiles.filter((f) =>
      folderId === null ? f.folder_id === null : f.folder_id === folderId
    );
    setDisplayItems([...folderData, ...visibleFiles]);
  };

  useEffect(() => {
    refreshData(activeFolderId);
  }, [activeFolderId]);

  /* ---------------- Folder Navigation ---------------- */
  const handleDoubleClick = (item: Item) => {
    if (item.type === "folder") {
      setFolderStack((prev) => [...prev, activeFolderId ?? "root"]); // 🟢 remember current folder
      setActiveFolderId(item.id);
    }
  };

  const handleGoBack = () => {
    setFolderStack((prev) => {
      if (prev.length === 0) {
        setActiveFolderId(null); // 🟢 root
        return [];
      }
      const newStack = [...prev];
      const last = newStack.pop();
      setActiveFolderId(last === "root" ? null : last ?? null);
      return newStack;
    });
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

  /* ---------------- ✅ File Upload (chunked) ---------------- */
  const handleFileUpload = async (file: globalThis.File, onProgress?: (p: number) => void) => {
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

  /* ---------------- Drag → Drop onto folder ---------------- */
  const handleDropOnFolder = async (source: Item | Item[], destinationFolderId: string) => {
    try {
      const sources = Array.isArray(source) ? source : [source];
      for (const s of sources) {
        if (s.type === "file") {
          await fetch(`/api/items/files/move/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder_id: destinationFolderId }),
          });
        } else if (s.type === "folder" && s.id !== destinationFolderId) {
          await fetch(`/api/items/folders/move/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parent_id: destinationFolderId, context: "files" }),
          });
        }
      }
      await refreshData(activeFolderId);
    } catch (err) {
      console.error("❌ Drop-on-folder failed:", err);
      setAlertMessage("Move failed. Please try again.");
    }
  };

  /* ---------------- ✅ Drop onto “move to parent” bar ---------------- */
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
        if (s.type === "file") {
          await fetch(`/api/items/files/move/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder_id: parentId }),
          });
        } else if (s.type === "folder") {
          if (s.id === parentId) continue;
          await fetch(`/api/items/folders/move/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parent_id: parentId, context: "files" }),
          });
        }
      }
      await refreshData(activeFolderId);
    } catch (e) {
      console.error("❌ Move-to-parent failed:", e);
      setAlertMessage("Failed to move item(s) to parent folder.");
    }
  };

  /* ---------------- Delete ---------------- */
  const confirmDeleteAction = async () => {
    setConfirmDelete(false);
    const folderIds = displayItems.filter((i) => i.type === "folder" && selectedItems.includes(i.id)).map((f) => f.id);
    const fileIds = displayItems.filter((i) => i.type === "file" && selectedItems.includes(i.id)).map((f) => f.id);
    if (fileIds.length)
      await fetch("/api/items/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: fileIds }),
      });
    if (folderIds.length)
      await fetch("/api/items/folders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: folderIds, context: "files" }),
      });
    await refreshData(activeFolderId);
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title="Files"
        icon={FileIcon}
        activeFolder={activeFolderId}
        goBack={handleGoBack}
        showBack={folderStack.length > 0 || !!activeFolderId} // 🟢 optional: hide back in root
        selectedItems={selectedItems}
        onSelectAll={() => setSelectedItems(displayItems.map((i) => i.id))}
        onDeselectAll={() => setSelectedItems([])}
        extraActions={[
          { icon: MoveRight, label: "Move", onClick: () => setAlertMessage("Use drag & drop"), disabled: !selectedItems.length },
          { icon: Trash2, label: "Delete", color: "red", onClick: () => setConfirmDelete(true), disabled: !selectedItems.length },
        ]}
      />

      <main className="px-6 sm:px-20 pb-20">
        <GenericGrid
          items={displayItems}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          onDropOnFolder={handleDropOnFolder}
          onDropToParent={handleDropToParent}
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
      <FileUploadPopup
        isOpen={isFileUploadOpen}
        onClose={() => setIsFileUploadOpen(false)}
        onFileUpload={handleFileUpload}
      />
      <CreateFolderPopup
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      {alertMessage && <AlertPopup message={alertMessage} onClose={() => setAlertMessage(null)} />}
      {confirmDelete && <AlertPopup message={`Delete ${selectedItems.length} item(s)?`} onClose={confirmDeleteAction} />}
    </div>
  );
}
