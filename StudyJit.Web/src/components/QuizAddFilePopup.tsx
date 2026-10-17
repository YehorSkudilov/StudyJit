"use client";

import Modal from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";

import React, { useEffect, useState } from "react";
import {
  Folder,
  FolderOpen,
  File,
  Search,
  ChevronRight,
  ChevronDown,
  Check,
  X, FilePlus2 } from "lucide-react";

interface FileItem {
  id: number;
  name: string;
  size?: number;
  folder_id?: number | null;
  type: "file";
}

interface FolderItem {
  id: number;
  name: string;
  parent_id?: number | null;
  type: "folder";
}

interface QuizAddFilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFiles: (files: FileItem[]) => void;
  existingFileIds: number[];
}

interface TreeNode {
  id: number;
  name: string;
  type: "folder" | "file";
  size?: number;
  parent_id?: number | null;
  children?: TreeNode[];
  isLoaded?: boolean;
  isLoading?: boolean;
}

export default function QuizAddFilePopup({
  isOpen,
  onClose,
  onAddFiles,
  existingFileIds,
}: QuizAddFilePopupProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [limitWarning, setLimitWarning] = useState(false);

  const MAX_SELECTION = 10;

  /* ---------------- Fetch root folders & ONLY root files ---------------- */
  useEffect(() => {
    if (!isOpen) return;

    const loadRoot = async () => {
      try {
        const [foldersRes, filesRes] = await Promise.all([
          apiFetch(`/api/items/folders?parent=root&context=files`),
          apiFetch(`/api/items/files`),
        ]);
        const folders: FolderItem[] = await foldersRes.json();
        const allFiles: FileItem[] = await filesRes.json();

        const rootFiles = allFiles.filter(
          (f) => f.folder_id === null && !existingFileIds.includes(f.id)
        );

        const roots: TreeNode[] = [
          ...folders.map((f) => ({
            id: f.id,
            name: f.name,
            type: "folder" as const,
            parent_id: f.parent_id ?? null,
            children: [],
            isLoaded: false,
          })),
          ...rootFiles.map((f) => ({
            id: f.id,
            name: f.name,
            type: "file" as const,
            size: f.size,
          })),
        ];

        setTree(roots);
      } catch (err) {
        console.error("❌ Failed to load root folders/files:", err);
      }
    };

    loadRoot();
  }, [isOpen, existingFileIds]);

  /* ---------------- Lazy-load folder contents ---------------- */
  const loadFolderContents = async (folderId: number) => {
    setTree((prev) => markFolder(folderId, { isLoading: true }));

    try {
      const [foldersRes, filesRes] = await Promise.all([
        apiFetch(`/api/items/folders?parent=${folderId}&context=files`),
        apiFetch(`/api/items/files`),
      ]);
      const folders: FolderItem[] = await foldersRes.json();
      const allFiles: FileItem[] = await filesRes.json();

      const files = allFiles.filter(
        (f) => f.folder_id === folderId && !existingFileIds.includes(f.id)
      );

      const children: TreeNode[] = [
        ...folders.map((f) => ({
          id: f.id,
          name: f.name,
          type: "folder" as const,
          parent_id: f.parent_id ?? null,
          children: [],
          isLoaded: false,
        })),
        ...files.map((f) => ({
          id: f.id,
          name: f.name,
          type: "file" as const,
          size: f.size,
        })),
      ];

      setTree((prev) =>
        markFolder(folderId, {
          children,
          isLoaded: true,
          isLoading: false,
        })
      );
    } catch (err) {
      console.error(`❌ Failed to load folder ${folderId} contents:`, err);
      setTree((prev) => markFolder(folderId, { isLoading: false }));
    }
  };

  /* ---------------- Utility: recursively update folder ---------------- */
  const markFolder = (folderId: number, patch: Partial<TreeNode>): TreeNode[] => {
    const updateNodes = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((n) => {
        if (n.id === folderId && n.type === "folder") {
          return { ...n, ...patch };
        }
        if (n.children) return { ...n, children: updateNodes(n.children) };
        return n;
      });
    return updateNodes(tree);
  };

  /* ---------------- Folder Expand ---------------- */
  const toggleExpand = (id: number, node: TreeNode) => {
    setExpanded((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        if (node.type === "folder" && !node.isLoaded && !node.isLoading) {
          loadFolderContents(id);
        }
      }
      return newSet;
    });
  };

  /* ---------------- File Select (limited to 10) ---------------- */
  const toggleFile = (id: number) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        if (newSet.size >= MAX_SELECTION) {
          setLimitWarning(true);
          setTimeout(() => setLimitWarning(false), 2000);
          return prev;
        }
        newSet.add(id);
      }

      return newSet;
    });
  };

  /* ---------------- Add Selected Files ---------------- */
  const handleAddFiles = () => {
    const selected: FileItem[] = [];
    const traverse = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === "file" && selectedFiles.has(n.id)) {
          selected.push({
            id: n.id,
            name: n.name,
            size: n.size ?? 0,
            type: "file",
          });
        }
        if (n.children) traverse(n.children);
      }
    };
    traverse(tree);
    onAddFiles(selected);
    onClose();
  };

  /* ---------------- Recursive Tree Render ---------------- */
  const renderTree = (nodes: TreeNode[], depth = 0) => (
    <ul className="ml-1">
      {nodes
        .filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
        .map((node) => (
          <li key={node.id} className="my-1">
            <div
              className={`flex items-start py-1 px-2 rounded cursor-pointer transition ${
                node.type === "file"
                  ? selectedFiles.has(node.id)
                    ? "bg-brand-soft border border-brand"
                    : "hover:bg-surface-2"
                  : "hover:bg-surface-2"
              }`}
              style={{ paddingLeft: `${depth * 14 + 6}px` }}
              onClick={() =>
                node.type === "folder"
                  ? toggleExpand(node.id, node)
                  : toggleFile(node.id)
              }
            >
              {node.type === "folder" ? (
                <>
                  {expanded.has(node.id) ? (
                    <ChevronDown className="w-4 h-4 mr-1 text-gray-500 mt-[3px]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-1 text-gray-500 mt-[3px]" />
                  )}
                  {expanded.has(node.id) ? (
                    <FolderOpen className="w-4 h-4 text-yellow-500 mr-2 mt-[3px]" />
                  ) : (
                    <Folder className="w-4 h-4 text-yellow-500 mr-2 mt-[3px]" />
                  )}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {node.name}
                  </span>
                  {node.isLoading && (
                    <span className="ml-2 text-xs text-gray-400 italic">
                      Loading...
                    </span>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-4 h-4 mt-[2px] rounded border flex items-center justify-center ${
                        selectedFiles.has(node.id)
                          ? "bg-brand border-brand"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {selectedFiles.has(node.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <File className="w-4 h-4 text-brand mt-[2px]" />
                    <span
                      className="text-gray-800 dark:text-gray-100 whitespace-normal break-words leading-snug text-sm max-w-[260px]"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {node.name}
                    </span>
                  </div>
                  {node.size && (
                    <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                      {(node.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              )}
            </div>

            {node.children &&
              node.children.length > 0 &&
              expanded.has(node.id) &&
              renderTree(node.children, depth + 1)}
          </li>
        ))}
    </ul>
  );

  if (!isOpen) return null;

  return (
    <Modal isOpen onClose={onClose} title="Add files" icon={<FilePlus2 className="w-5 h-5" />} width="max-w-lg">
        {/* 🔍 Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Search folders or files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>

        {/* 📁 Tree */}
        <div className="flex-1 overflow-y-auto border border-stroke rounded-xl p-2 min-h-48">
          {tree.length === 0 ? (
            <p className="text-muted text-center py-8 text-sm sm:text-base">
              No folders or files found.
            </p>
          ) : (
            renderTree(tree)
          )}
        </div>

        {/* ⚠️ Limit Warning */}
        {limitWarning && (
          <p className="text-red-500 text-sm text-center mt-2">
            You can select up to {MAX_SELECTION} files only.
          </p>
        )}

        {/* 🧭 Footer */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleAddFiles}
            disabled={selectedFiles.size === 0}
            className="btn-primary"
          >
            Add {selectedFiles.size > 0 ? `(${selectedFiles.size})` : ""}
          </button>
        </div>
    </Modal>
  );
}
