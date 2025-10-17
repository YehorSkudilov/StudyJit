"use client";
import React from "react";
import FolderCard from "./FolderCard";
import QuizCard from "./QuizCard";

interface DashboardGridProps {
  subfolders: { name: string }[];
  folderQuizzes: { name: string; score: number }[];
  selectedItems: string[];
  onItemClick: (name: string, type: "folder" | "quiz", index: number, e: React.MouseEvent) => void;
  onFolderDoubleClick: (name: string) => void;
  onQuizDoubleClick: (name: string) => void;
  quizzes: { name: string; score: number; folder?: string }[];
  activeFolder: string | null;
}

export default function DashboardGrid({
  subfolders,
  folderQuizzes,
  selectedItems,
  onItemClick,
  onFolderDoubleClick,
  onQuizDoubleClick,
  quizzes,
  activeFolder,
}: DashboardGridProps) {
  // Flatten visible items
  const visibleItems = [
    ...subfolders.map(f => ({ type: "folder" as const, name: f.name })),
    ...folderQuizzes.map(q => ({ type: "quiz" as const, name: q.name })),
    ...(!activeFolder ? quizzes.filter(q => !q.folder).map(q => ({ type: "quiz" as const, name: q.name })) : []),
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visibleItems.map((item, idx) => {
        if (item.type === "folder") {
          return (
            <FolderCard
              key={item.name}
              folderName={item.name}
              quizCount={quizzes.filter(q => q.folder === item.name).length}
              selected={selectedItems.includes(item.name)}
              onClick={(e) => onItemClick(item.name, "folder", idx, e)}
              onDoubleClick={() => onFolderDoubleClick(item.name)}
            />
          );
        } else {
          const quiz = folderQuizzes.find(q => q.name === item.name) || quizzes.find(q => q.name === item.name)!;
          return (
            <QuizCard
              key={item.name}
              quizName={quiz.name}
              score={quiz.score}
              selected={selectedItems.includes(item.name)}
              onClick={(e) => onItemClick(item.name, "quiz", idx, e)}
              onDoubleClick={() => onQuizDoubleClick(item.name)}
            />
          );
        }
      })}
    </div>
  );
}
