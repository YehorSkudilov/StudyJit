"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import GenericGrid from "@/components/GenericGrid";
import FileCard from "@/components/FileCard";
import FolderCard from "@/components/FolderCard";
import FloatingAddButton from "@/components/FloatingAddButton";
import FileUploadPopup from "@/components/FileUploadPopup";
import { Item } from "@/types/Item";
import { File, Folder } from "lucide-react";

export default function FilesPage() {
  const [files, setFiles] = useState<Item[]>([]);
  const [folders, setFolders] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const fetchFilesAndFolders = async () => {
    try {
      const res = await fetch("/api/db/files", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();

      // ✅ Separate folders and files
      setFolders(
        data
          .filter((f: any) => f.type === "folder")
          .map((f: any) => ({
            id: `folder-${f.id}`,
            type: "folder",
            name: f.name,
            size: 0,
          }))
      );

      setFiles(
        data
          .filter((f: any) => f.type === "file")
          .map((f: any) => ({
            id: `file-${f.id}`,
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
    fetchFilesAndFolders();
  }, []);

  // ✅ Navigate into folder
  const handleOpenFolder = (folderName: string) => {
    setActiveFolder(folderName);
    // Example: fetch folder contents
    // fetch(`/api/db/files?folder=${folderName}`)
  };

  const handleFileUpload = async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
    let start = 0;
    while (start < file.size) {
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const headers = {
        "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
        "X-Filename": encodeURIComponent(file.name),
      };
      const res = await fetch("/api/db/files/upload", {
        method: "POST",
        headers,
        body: chunk,
      });
      if (!res.ok) throw new Error(`Chunk failed: ${await res.text()}`);
      onProgress?.(Math.round((end / file.size) * 100));
      start = end;
    }
    await fetchFilesAndFolders();
  };

  const handleDeleteSelected = async () => {
    for (const id of selectedItems) {
      await fetch(`/api/db/files/${id.replace(/^file-|^folder-/, "")}`, {
        method: "DELETE",
      });
    }
    setSelectedItems([]);
    await fetchFilesAndFolders();
  };

  const handleSelectAll = () =>
    setSelectedItems([...folders, ...files].map((f) => f.id));
  const handleDeselectAll = () => setSelectedItems([]);
  const handleReorder = (newOrder: Item[]) => setFiles(newOrder);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative">
      <PageHeader
        title="Files"
        icon={activeFolder ? Folder : File}
        activeFolder={activeFolder}
        goBack={() => setActiveFolder(null)}
        selectedItems={selectedItems}
        onDeleteSelected={handleDeleteSelected}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
      />

      <main className="px-6 sm:px-20 pb-20 space-y-10">
        {!activeFolder && folders.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
              Folders
            </h2>
            <GenericGrid
              items={folders}
              selectedItems={selectedItems}
              setSelectedItems={setSelectedItems}
              renderItem={(item, isSelected, onClick) => (
                <FolderCard
                  folderName={item.name}
                  itemCount={0}
                  selected={isSelected}
                  onClick={onClick}
                  onDoubleClick={() => handleOpenFolder(item.name)}
                />
              )}
            />
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
            {activeFolder ? `Files in ${activeFolder}` : "Files"}
          </h2>
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
        </section>
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
