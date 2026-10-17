"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";
import Modal from "@/components/ui/Modal";

type CreateFolderPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (name: string) => void;
};

export default function CreateFolderPopup({ isOpen, onClose, onCreateFolder }: CreateFolderPopupProps) {
  const [folderName, setFolderName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim() !== "") {
      onCreateFolder(folderName.trim());
      setFolderName("");
      onClose();
    }
  };

  const handleCancel = () => {
    setFolderName("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="New folder" icon={<FolderPlus className="w-5 h-5" />} width="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Folder name"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          className="input"
          autoFocus
        />
        <button type="submit" className="btn-primary w-full" disabled={!folderName.trim()}>
          Create folder
        </button>
      </form>
    </Modal>
  );
}
