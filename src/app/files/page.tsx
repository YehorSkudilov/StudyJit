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
import { File as FileIcon, FilePlus, FolderPlus, Folder, Trash2 } from "lucide-react";

type FolderCrumb = { id: string | null; name: string };

export default function FilesPage() {
  const [folders, setFolders] = useState<Item[]>([]);
  const [files, setFiles] = useState<Item[]>([]);
  const [displayItems, setDisplayItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeFolderName, setActiveFolderName] = useState<string>("Files");
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([]);

  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* ---------------- Load persisted folder state ---------------- */
  useEffect(() => {
    const savedId = sessionStorage.getItem("filesActiveFolderId");
    const savedName = sessionStorage.getItem("filesActiveFolderName");
    const savedStack = sessionStorage.getItem("filesFolderStack");

    if (savedId !== null) setActiveFolderId(savedId === "null" ? null : savedId);
    if (savedName) setActiveFolderName(savedName);
    if (savedStack) setFolderStack(JSON.parse(savedStack));
  }, []);

  /* ---------------- Persist folder state ---------------- */
  useEffect(() => {
    sessionStorage.setItem("filesActiveFolderId", String(activeFolderId));
    sessionStorage.setItem("filesActiveFolderName", activeFolderName);
    sessionStorage.setItem("filesFolderStack", JSON.stringify(folderStack));
  }, [activeFolderId, activeFolderName, folderStack]);

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
      const currentCrumb: FolderCrumb = { id: activeFolderId, name: activeFolderName };
      setFolderStack((prev) => [...prev, currentCrumb]);
      setActiveFolderId(item.id);
      setActiveFolderName(item.name);
    }
  };

  const handleGoBack = () => {
    if (folderStack.length > 0) {
      const prevStack = [...folderStack];
      const last = prevStack.pop()!;
      setFolderStack(prevStack);
      setActiveFolderId(last.id);
      setActiveFolderName(last.name || "Files");
    } else {
      setActiveFolderId(null);
      setActiveFolderName("Files");
    }
  };

  /* ---------------- Folder Rename ---------------- */
  const handleRenameFolder = async (newName: string) => {
    if (!activeFolderId) return;
    try {
      const res = await fetch(`/api/items/folders/rename/${activeFolderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, context: "files" }),
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
    await fetch("/api/items/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: activeFolderId, context: "files" }),
    });
    await refreshData(activeFolderId);
    setIsCreateFolderOpen(false);
  };

  /* ---------------- File Upload ---------------- */
  const handleFileUpload = async (file: globalThis.File, onProgress?: (p: number) => void) => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
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

  /* ---------------- YouTube Upload ---------------- */
  const handleYouTubeUpload = async (url: string) => {
    try {
      const res = await fetch("/api/items/files/upload", {
        method: "POST",
        headers: {
          "x-url": encodeURIComponent(url.trim()),
          "x-folder": activeFolderId ?? "root",
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      await refreshData(activeFolderId);
      setAlertMessage("🎬 YouTube video uploaded successfully!");
    } catch (err: any) {
      setAlertMessage(err.message || "Failed to upload YouTube video.");
    }
  };

  /* ---------------- Drag & Drop ---------------- */
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
    } catch {
      setAlertMessage("Move failed. Please try again.");
    }
  };

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

      const movedIds = sources.map((s) => s.id);
      setDisplayItems((prev) => prev.filter((item) => !movedIds.includes(item.id)));
      await fetchFolders(activeFolderId);
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
    const fileIds = displayItems
      .filter((i) => i.type === "file" && selectedItems.includes(i.id))
      .map((f) => f.id);

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
        title={activeFolderName}
        icon={activeFolderId ? Folder : FileIcon}
        color={activeFolderId ? "yellow" : "blue"}
        goBack={handleGoBack}
        showBack={folderStack.length > 0 || !!activeFolderId}
        activeFolder={activeFolderName}
        canRename={!!activeFolderId}
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
          {
            key: "upload",
            title: "Upload File or Link",
            subtitle: "Upload to current folder",
            color: "blue",
            icon: FilePlus,
            onClick: () => setIsFileUploadOpen(true),
          },
          {
            key: "folder",
            title: "Create Folder",
            subtitle: "Organize files",
            color: "yellow",
            icon: FolderPlus,
            onClick: () => setIsCreateFolderOpen(true),
          },
        ]}
      />

      {/* Pass folder ID + YouTube upload handler */}
      <FileUploadPopup
        isOpen={isFileUploadOpen}
        onClose={() => setIsFileUploadOpen(false)}
        onFileUpload={handleFileUpload}
        onYouTubeUpload={handleYouTubeUpload}
      />

      <CreateFolderPopup
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      {alertMessage && <AlertPopup message={alertMessage} onClose={() => setAlertMessage(null)} />}
      {confirmDelete && (
        <AlertPopup message={`Delete ${selectedItems.length} item(s)?`} onClose={confirmDeleteAction} />
      )}
    </div>
  );
}
