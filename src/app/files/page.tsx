"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import GenericGrid from "@/components/GenericGrid";
import FileCard from "@/components/FileCard";
import FolderCard from "@/components/FolderCard";
import FloatingAddButton from "@/components/FloatingAddButton";
import GenericActionPopup from "@/components/GenericActionPopup";
import FileUploadPopup from "@/components/FileUploadPopup";
import CreateFolderPopup from "@/components/CreateFolderPopup";
import { Item } from "@/types/Item";
import { File, FilePlus, FolderPlus } from "lucide-react";

export default function FilesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isActionChooserOpen, setIsActionChooserOpen] = useState(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  /* ---------------- Fetch Files and Folders ---------------- */
  const fetchItems = async () => {
    try {
      const filesRes = await fetch("/api/db/files", { cache: "no-store" });
      if (!filesRes.ok) throw new Error("Failed to load files");
      const filesData = await filesRes.json();

      const foldersRes = await fetch("/api/db/folders", { cache: "no-store" });
      const foldersData = foldersRes.ok ? await foldersRes.json() : [];

      const allItems: Item[] = [
        ...foldersData.map((f: any) => ({
          id: `folder-${f.id}`,
          type: "folder" as const,
          name: f.name,
          itemCount: f.itemCount || 0,
        })),
        ...filesData.map((f: any) => ({
          id: `file-${f.id}`,
          type: "file" as const,
          name: f.name,
          size: f.size,
        })),
      ];

      setItems(allItems);
    } catch (err) {
      console.error("❌ Error fetching items:", err);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  /* ---------------- Upload File in Chunks ---------------- */
  const handleFileUpload = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
    let start = 0;
    let part = 0;

    console.log(`🚀 Uploading: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    while (start < file.size) {
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const headers: Record<string, string> = {
        "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
        "X-Filename": encodeURIComponent(file.name),
      };

      if (activeFolder) {
        headers["X-Folder-Id"] = activeFolder;
      }

      const res = await fetch("/api/db/files/upload", {
        method: "POST",
        headers,
        body: chunk,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Chunk ${part} failed: ${err}`);
      }

      const progress = Math.round((end / file.size) * 100);
      onProgress?.(progress);
      start = end;
      part++;
    }

    console.log(`✅ Upload complete: ${file.name}`);
    await fetchItems();
  };

  /* ---------------- Create Folder ---------------- */
  const handleCreateFolder = async (name: string): Promise<void> => {
    const res = await fetch("/api/db/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parentId: activeFolder,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || "Failed to create folder");
    }

    await fetchItems();
  };

  /* ---------------- Delete Selected ---------------- */
  const handleDeleteSelected = async () => {
    for (const id of selectedItems) {
      try {
        const [type, realId] = id.split("-");
        const endpoint =
          type === "folder" ? `/api/db/folders/${realId}` : `/api/db/files/${realId}`;
        const res = await fetch(endpoint, { method: "DELETE" });
        if (!res.ok) throw new Error(`Failed to delete ${type} ${realId}`);
      } catch (err) {
        console.error("❌ Delete error:", err);
      }
    }
    setSelectedItems([]);
    await fetchItems();
  };

  /* ---------------- Selection Helpers ---------------- */
  const handleSelectAll = () => setSelectedItems(items.map((i) => i.id));
  const handleDeselectAll = () => setSelectedItems([]);
  const handleReorder = (newOrder: Item[]) => setItems(newOrder);

  /* ---------------- Double Click ---------------- */
  const handleItemDoubleClick = (item: Item) => {
    if (item.type === "folder") {
      setActiveFolder(item.id.split("-")[1]);
    } else {
      console.log(`Opened file: ${item.name}`);
    }
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative">
      <PageHeader
        title="Files"
        icon={File}
        activeFolder={activeFolder}
        goBack={() => setActiveFolder(null)}
        selectedItems={selectedItems}
        onDeleteSelected={handleDeleteSelected}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
      />

      <main className="px-6 sm:px-20 pb-20">
        <GenericGrid
          items={items}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          onReorder={handleReorder}
          renderItem={(item, isSelected, onClick) => {
            if (item.type === "folder") {
              return (
                <FolderCard
                  folderName={item.name}
                  itemCount={item.itemCount || 0}
                  selected={isSelected}
                  onClick={onClick}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                />
              );
            } else {
              return (
                <FileCard
                  fileName={item.name}
                  fileSize={item.size}
                  selected={isSelected}
                  onClick={onClick}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                />
              );
            }
          }}
        />
      </main>

      {/* Floating Add Button */}
      <FloatingAddButton onClick={() => setIsActionChooserOpen(true)} />

      {/* Generic Action Popup */}
      <GenericActionPopup
        isOpen={isActionChooserOpen}
        onClose={() => setIsActionChooserOpen(false)}
        title="Choose Action"
        actions={[
          {
            key: "upload",
            title: "Upload File",
            subtitle: "Upload one or more files",
            color: "blue",
            icon: FilePlus,
            onClick: () => setIsFileUploadOpen(true),
          },
          {
            key: "folder",
            title: "Create Folder",
            subtitle: "Organize your files",
            color: "green",
            icon: FolderPlus,
            onClick: () => setIsCreateFolderOpen(true),
          },
        ]}
      />

      {/* Upload Popup */}
      <FileUploadPopup
        isOpen={isFileUploadOpen}
        onClose={() => setIsFileUploadOpen(false)}
        onFileUpload={handleFileUpload}
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
