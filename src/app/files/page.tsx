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
import { Item } from "@/types/Item";
import { File, FilePlus, FolderPlus, MoveRight } from "lucide-react";

export default function FilesPage() {
  const [allFiles, setAllFiles] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Item[]>([]);
  const [displayItems, setDisplayItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string>("root");
  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isMovePopupOpen, setIsMovePopupOpen] = useState(false);

  /* ---------------- Fetch Folders ---------------- */
  const fetchFolders = async (path: string) => {
    try {
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
    } catch (err) {
      console.error("❌ Failed to load folders:", err);
      return [];
    }
  };

  /* ---------------- Fetch Files ---------------- */
  const fetchFiles = async (path: string) => {
    try {
      const res = await fetch("/api/db/files", { cache: "no-store" });
      const data = await res.json();
      setAllFiles(data);
      return data;
    } catch (err) {
      console.error("❌ Failed to load files:", err);
      return [];
    }
  };

  const refreshData = async (path: string = activePath) => {
    const [foldersData, filesData] = await Promise.all([
      fetchFolders(path),
      fetchFiles(path),
    ]);
    const filesInFolder = filesData.filter((f: any) => f.folder_path === path || f.path === path);
    setDisplayItems([...foldersData, ...filesInFolder.map((f: any) => ({ ...f, type: "file" }))]);
  };

  useEffect(() => {
    refreshData(activePath);
  }, [activePath]);

  /* ---------------- Navigation ---------------- */
  const handleItemDoubleClick = (item: Item) => {
    if (item.type === "folder") {
      setActivePath(item.full_path || item.id.replace("folder-", ""));
    } else {
      console.log(`Opened file: ${item.name}`);
    }
  };

  const handleGoBack = () => {
    if (activePath === "root") return;
    const parent = activePath.split("/").slice(0, -1).join("/") || "root";
    setActivePath(parent);
  };

  /* ---------------- Folder Creation ---------------- */
  const handleCreateFolder = async (name: string) => {
    await fetch("/api/db/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_path: activePath }),
    });
    await refreshData(activePath);
    setIsCreateFolderOpen(false);
  };

  /* ---------------- File Upload ---------------- */
  const handleFileUpload = async (file: File, onProgress?: (p: number) => void) => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
    let start = 0;
    while (start < file.size) {
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const res = await fetch("/api/db/files/upload", {
        method: "POST",
        headers: {
          "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
          "X-Filename": encodeURIComponent(file.name),
          "X-Folder": activePath,
        },
        body: chunk,
      });
      if (!res.ok) throw new Error("Chunk failed");
      start = end;
      onProgress?.(Math.round((end / file.size) * 100));
    }
    await refreshData(activePath);
  };

  /* ---------------- Move Items ---------------- */
  const handleMoveItems = async (newFolderPath: string) => {
    for (const id of selectedItems) {
      const [type, realId] = id.split("-");
      if (type !== "file") continue;
      await fetch(`/api/db/files/move/${realId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_path: newFolderPath }),
      });
    }
    setSelectedItems([]);
    await refreshData(activePath);
  };

  /* ---------------- Delete ---------------- */
  const handleDeleteSelected = async () => {
    for (const id of selectedItems) {
      const [type, realId] = id.split("-");
      if (type === "file") {
        await fetch(`/api/db/files/${realId}`, { method: "DELETE" });
      }
    }
    setSelectedItems([]);
    await refreshData(activePath);
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title="Files"
        icon={File}
        activeFolder={activePath === "root" ? null : activePath}
        goBack={handleGoBack}
        selectedItems={selectedItems}
        onDeleteSelected={handleDeleteSelected}
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
              <FolderCard
                folderName={item.name}
                itemCount={item.itemCount || 0}
                selected={isSelected}
                onClick={onClick}
                onDoubleClick={() => handleItemDoubleClick(item)}
              />
            ) : (
              <FileCard
                fileName={item.name}
                fileSize={item.size}
                selected={isSelected}
                onClick={onClick}
                onDoubleClick={() => handleItemDoubleClick(item)}
              />
            )
          }
        />
      </main>

      <FloatingAddButton onClick={() => setIsActionChooserOpen(true)} />

      <GenericActionPopup
        isOpen={isActionChooserOpen}
        onClose={() => setIsActionChooserOpen(false)}
        title="Choose Action"
        actions={[
          {
            key: "upload",
            title: "Upload File",
            subtitle: "Upload to current folder",
            color: "blue",
            icon: FilePlus,
            onClick: () => setIsFileUploadOpen(true),
          },
          {
            key: "folder",
            title: "Create Folder",
            subtitle: "Add subfolder",
            color: "green",
            icon: FolderPlus,
            onClick: () => setIsCreateFolderOpen(true),
          },
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

      <MoveItemPopup
        isOpen={isMovePopupOpen}
        onClose={() => setIsMovePopupOpen(false)}
        folders={folders.map((f) => f.full_path)}
        onMove={handleMoveItems}
      />
    </div>
  );
}
