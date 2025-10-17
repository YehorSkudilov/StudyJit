"use client";
import React, { useState } from "react";
import FileGrid from "@/components/FileGrid"; // Import the FileGrid component
import FileUploadPopup from "@/components/FileUploadPopup"; // Import the FileUploadPopup component
import FloatingAddButton from "@/components/FloatingAddButton"; // Import the FloatingAddButton component
import DashboardHeader from "@/components/DashboardHeader"; // Import the DashboardHeader component

export default function FileUploadPage() {
  const [files, setFiles] = useState([
    { name: "Document1.pdf", size: 1024 },
    { name: "Image1.png", size: 2048 },
    { name: "Report.docx", size: 512 },
  ]);

  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null); // Track active folder

  // Handle file selection
  const handleFileClick = (name: string, index: number, e: React.MouseEvent) => {
    const newSelectedFiles = selectedFiles.includes(name)
      ? selectedFiles.filter((file) => file !== name)
      : [...selectedFiles, name];
    setSelectedFiles(newSelectedFiles);
  };

  // Handle file double-click
  const handleFileDoubleClick = (file: { name: string; size: number }) => {
    alert(`You double-clicked on: ${file.name}`);
  };

  // Handle file reorder
  const handleReorder = (newOrder: { name: string }[]) => {
    setFiles(newOrder.map((item) => ({ name: item.name, size: 1024 }))); // Update files order
  };

  // Handle file upload
  const handleFileUpload = (file: File) => {
    const newFile = { name: file.name, size: file.size };
    setFiles((prevFiles) => [...prevFiles, newFile]);
  };

  // Handle file selection actions (select all/deselect all)
  const handleSelectAll = () => {
    setSelectedFiles(files.map((file) => file.name)); // Select all files
  };

  const handleDeselectAll = () => {
    setSelectedFiles([]); // Deselect all files
  };

  const handleDeleteSelected = () => {
    setFiles(files.filter((file) => !selectedFiles.includes(file.name)));
    setSelectedFiles([]); // Clear selected files after deletion
  };

  return (
    <div className="p-8">
      {/* Dashboard Header */}
      <DashboardHeader
        activeFolder={activeFolder}
        goBack={() =>
          setActiveFolder(
            // Assuming folders is a list of folders with their names and parents
            activeFolder ? null : "Root Folder" // Example logic to set the folder name
          )
        }
        selectedItems={selectedFiles} // Pass selected files as items
        onDeleteSelected={handleDeleteSelected}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
      />

      {/* File Grid */}
      <FileGrid
        files={files}
        selectedFiles={selectedFiles}
        onFileClick={handleFileClick}
        onFileDoubleClick={handleFileDoubleClick}
        onReorder={handleReorder}
      />

      {/* File Upload Popup */}
      <FileUploadPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onFileUpload={handleFileUpload}
      />

      {/* Floating Add Button */}
      <FloatingAddButton onClick={() => setIsPopupOpen(true)} />
    </div>
  );
}
