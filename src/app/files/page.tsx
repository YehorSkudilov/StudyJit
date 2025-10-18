"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import GenericGrid from "@/components/GenericGrid";
import FileCard from "@/components/FileCard";
import FloatingAddButton from "@/components/FloatingAddButton";
import FileUploadPopup from "@/components/FileUploadPopup";
import { Item } from "@/types/Item";
import { File } from "lucide-react";

export default function FilesPage() {
  const [files, setFiles] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  // ✅ Fetch files from DB (GET /api/files)
  const fetchFiles = async () => {
    try {
      const res = await fetch("/api/db/files", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setFiles(
        data.map((f: any) => ({
          id: f.id.toString(),
          type: "file",
          name: f.name,
          size: f.size,
        }))
      );
    } catch (err) {
      console.error("❌ Error fetching files:", err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // ✅ Upload new file to backend (POST /api/files/upload)
  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/db/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      console.log("✅ Uploaded:", result);

      await fetchFiles(); // Refresh list
    } catch (err) {
      console.error("❌ Upload error:", err);
    }
  };

  // ✅ Delete selected files using DELETE /api/files/:id
  const handleDeleteSelected = async () => {
    for (const id of selectedItems) {
      try {
        const res = await fetch(`/api/db/files/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete file " + id);
      } catch (err) {
        console.error("❌ Delete error:", err);
      }
    }
    setSelectedItems([]);
    await fetchFiles();
  };

  // ✅ Selection controls
  const handleSelectAll = () => setSelectedItems(files.map((f) => f.id));
  const handleDeselectAll = () => setSelectedItems([]);

  // ✅ Drag reorder (visual only)
  const handleReorder = (newOrder: Item[]) => setFiles(newOrder);

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
          items={files}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          onReorder={handleReorder}
          renderItem={(item, isSelected, onClick) => (
            <FileCard
              fileName={item.name}
              fileSize={item.size}
              selected={isSelected}
              onClick={onClick}
              onDoubleClick={() => console.log(`Opened ${item.name}`)}
            />
          )}
        />
      </main>

      <FloatingAddButton onClick={() => setIsPopupOpen(true)} />
      <FileUploadPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onFileUpload={handleFileUpload}
      />
    </div>
  );
}
