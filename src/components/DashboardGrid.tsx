"use client";
import React from "react";
import FolderCard from "./FolderCard";
import QuizCard from "./QuizCard";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DashboardGridProps {
  subfolders: { name: string }[];
  folderQuizzes: { name: string; score: number }[];
  selectedItems: string[];
  onItemClick: (
    name: string,
    type: "folder" | "quiz",
    index: number,
    e: React.MouseEvent
  ) => void;
  onFolderDoubleClick: (name: string) => void;
  onQuizDoubleClick: (name: string) => void;
  quizzes: { name: string; score: number; folder?: string }[];
  activeFolder: string | null;
  onReorder?: (newOrder: { type: "folder" | "quiz"; name: string }[]) => void;
}

/* ---- Sortable Item Wrapper ---- */
function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? "grabbing" : "grab",
    outline: "none", // ✅ disable focus ring
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // prevent white border focus on Shift/Ctrl or drag
    e.preventDefault();
    if (e.button === 0) {
      e.currentTarget.blur();
      document.body.style.userSelect = "none";
    }
  };

  const handlePointerUp = () => {
    document.body.style.userSelect = "";
  };

  return (
    <div
      ref={setNodeRef}
      tabIndex={-1} // ✅ removes keyboard focus highlight
      style={style}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      {...attributes}
      {...listeners}
      draggable={false}
    >
      {children}
    </div>
  );
}

/* ---- Dashboard Grid ---- */
export default function DashboardGrid({
  subfolders,
  folderQuizzes,
  selectedItems,
  onItemClick,
  onFolderDoubleClick,
  onQuizDoubleClick,
  quizzes,
  activeFolder,
  onReorder,
}: DashboardGridProps) {
  const visibleItems = React.useMemo(
    () => [
      ...subfolders.map((f) => ({ type: "folder" as const, name: f.name })),
      ...folderQuizzes.map((q) => ({ type: "quiz" as const, name: q.name })),
      ...(!activeFolder
        ? quizzes
            .filter((q) => !q.folder)
            .map((q) => ({ type: "quiz" as const, name: q.name }))
        : []),
    ],
    [subfolders, folderQuizzes, quizzes, activeFolder]
  );

  const [items, setItems] = React.useState(visibleItems);

  React.useEffect(() => {
    setItems(visibleItems);
  }, [visibleItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.name === active.id);
    const newIndex = items.findIndex((i) => i.name === over.id);
    const newOrder = arrayMove(items, oldIndex, newIndex);
    setItems(newOrder);
    onReorder?.(newOrder);

    // remove lingering browser focus ring
    document.activeElement instanceof HTMLElement && document.activeElement.blur();
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.name)}
        strategy={rectSortingStrategy}
      >
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch"
          style={{
            userSelect: "none",
            outline: "none",
            WebkitTapHighlightColor: "transparent", // ✅ disables mobile highlight
          }}
        >
          {items.map((item, idx) => (
            <SortableItem key={item.name} id={item.name}>
              {item.type === "folder" ? (
                <FolderCard
                  folderName={item.name}
                  quizCount={quizzes.filter((q) => q.folder === item.name).length}
                  selected={selectedItems.includes(item.name)}
                  onClick={(e) => onItemClick(item.name, "folder", idx, e)}
                  onDoubleClick={() => onFolderDoubleClick(item.name)}
                />
              ) : (
                <QuizCard
                  quizName={item.name}
                  score={
                    folderQuizzes.find((q) => q.name === item.name)?.score ??
                    quizzes.find((q) => q.name === item.name)?.score ??
                    0
                  }
                  selected={selectedItems.includes(item.name)}
                  onClick={(e) => onItemClick(item.name, "quiz", idx, e)}
                  onDoubleClick={() => onQuizDoubleClick(item.name)}
                />
              )}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
