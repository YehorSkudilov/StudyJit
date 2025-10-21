"use client";
import React, { useEffect, useState } from "react";
import { Folder, FolderOpen, File, Search, ChevronRight, ChevronDown, Check } from "lucide-react";

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

/* ---------------- Tree Node ---------------- */
interface TreeNode {
  id: number;
  name: string;
  type: "folder" | "file";
  size?: number;
  children?: TreeNode[];
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

  /* ---------------- Fetch folders & files ---------------- */
  useEffect(() => {
    if (!isOpen) return;

    const fetchAll = async () => {
      try {
        const [foldersRes, filesRes] = await Promise.all([
          fetch("/api/items/folders?context=files"),
          fetch("/api/items/files"),
        ]);
        const folders: FolderItem[] = await foldersRes.json();
        const files: FileItem[] = await filesRes.json();

        const filteredFiles = files.filter((f) => !existingFileIds.includes(f.id));

        const folderMap = new Map<number | null, TreeNode[]>();

        folders.forEach((f) => {
          const node: TreeNode = { id: f.id, name: f.name, type: "folder", children: [] };
          const parent = f.parent_id ?? null;
          if (!folderMap.has(parent)) folderMap.set(parent, []);
          folderMap.get(parent)!.push(node);
        });

        filteredFiles.forEach((f) => {
          const node: TreeNode = { id: f.id, name: f.name, size: f.size, type: "file" };
          const parent = f.folder_id ?? null;
          if (!folderMap.has(parent)) folderMap.set(parent, []);
          folderMap.get(parent)!.push(node);
        });

        const buildTree = (parent: number | null): TreeNode[] =>
          (folderMap.get(parent) || []).map((n) =>
            n.type === "folder" ? { ...n, children: buildTree(n.id) } : n
          );

        setTree(buildTree(null));
      } catch (err) {
        console.error("❌ Failed to load folder/file tree:", err);
      }
    };

    fetchAll();
  }, [isOpen, existingFileIds]);

  /* ---------------- Folder Expand ---------------- */
  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  /* ---------------- File Select ---------------- */
  const toggleFile = (id: number) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  /* ---------------- Add Selected Files ---------------- */
  const handleAddFiles = () => {
    const selected: FileItem[] = [];
    const traverse = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === "file" && selectedFiles.has(n.id))
          selected.push({ id: n.id, name: n.name, size: n.size ?? 0, type: "file" });
        if (n.children) traverse(n.children);
      }
    };
    traverse(tree);
    onAddFiles(selected);
    onClose();
  };

  /* ---------------- Render Tree Recursively ---------------- */
  const renderTree = (nodes: TreeNode[], depth = 0) => (
    <ul className="ml-2">
      {nodes
        .filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
        .map((node) => (
          <li key={node.id} className="my-1">
            <div
              className={`flex items-center py-1 px-2 rounded cursor-pointer transition ${
                node.type === "file"
                  ? selectedFiles.has(node.id)
                    ? "bg-blue-100 dark:bg-blue-900 border border-blue-500"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              style={{ paddingLeft: `${depth * 14 + 6}px` }}
              onClick={() =>
                node.type === "folder"
                  ? toggleExpand(node.id)
                  : toggleFile(node.id)
              }
            >
              {node.type === "folder" ? (
                <>
                  {expanded.has(node.id) ? (
                    <ChevronDown className="w-4 h-4 mr-1 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-1 text-gray-500" />
                  )}
                  {expanded.has(node.id) ? (
                    <FolderOpen className="w-4 h-4 text-yellow-500 mr-2" />
                  ) : (
                    <Folder className="w-4 h-4 text-yellow-500 mr-2" />
                  )}
                  <span className="font-medium text-gray-800 dark:text-gray-200">{node.name}</span>
                </>
              ) : (
                <>
                  <div
                    className={`w-4 h-4 mr-2 rounded border flex items-center justify-center ${
                      selectedFiles.has(node.id)
                        ? "bg-blue-500 border-blue-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {selectedFiles.has(node.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <File className="w-4 h-4 text-blue-500 mr-2" />
                  <span className="text-gray-800 dark:text-gray-100 flex-1 truncate">
                    {node.name}
                  </span>
                  {node.size && (
                    <span className="text-xs text-gray-400">
                      {(node.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </>
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-[500px] max-h-[85vh] flex flex-col">
        <h2 className="text-xl font-semibold mb-4 text-center text-gray-900 dark:text-gray-100">
          Add Files to Quiz
        </h2>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search folders or files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded border border-gray-300 dark:border-gray-600 
              bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tree list */}
        <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
          {tree.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No folders or files found.
            </p>
          ) : (
            renderTree(tree)
          )}
        </div>

        {/* Footer Buttons */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-600 
              text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAddFiles}
            disabled={selectedFiles.size === 0}
            className={`px-4 py-2 rounded transition
              ${
                selectedFiles.size > 0
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
          >
            Add {selectedFiles.size > 0 ? `(${selectedFiles.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
