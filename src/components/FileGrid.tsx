"use client";
import React from "react";
import FileCard from "./FileCard"; // Assuming FileCard is implemented
import {
  DndContext,
  closestCenter,
  DragEndEvent,
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

// FileGrid Props definition
interface FileGridProps {
  files: { name: string; size: number }[]; // List of files
  selectedFiles: string[]; // Track selected files
  onFileClick: (name: string, index: number, e: React.MouseEvent) => void;
  onFileDoubleClick: (file: { name: string; size: number }) => void;
  onReorder?: (newOrder: { name: string }[]) => void; // Optional reorder function
}

// Sortable Item Wrapper
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
    outline: "none",
    height: "100%",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} draggable={false}>
      {children}
    </div>
  );
}

// FileGrid Component
export default function FileGrid({
  files,
  selectedFiles,
  onFileClick,
  onFileDoubleClick,
  onReorder,
}: FileGridProps) {
  const [items, setItems] = React.useState(files);

  // Reorder items when the list changes
  React.useEffect(() => {
    setItems(files);
  }, [files]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.name === active.id);
    const newIndex = items.findIndex((i) => i.name === over.id);
    const newOrder = arrayMove(items, oldIndex, newIndex);
    setItems(newOrder);
    onReorder?.(newOrder);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.name)} strategy={rectSortingStrategy}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {items.map((file, idx) => (
            <SortableItem key={file.name} id={file.name}>
              <FileCard
                fileName={file.name}
                fileSize={file.size}
                selected={selectedFiles.includes(file.name)}
                onClick={(e) => onFileClick(file.name, idx, e)}
                onDoubleClick={() => onFileDoubleClick(file)}
              />
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
