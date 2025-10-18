"use client";
import React from "react";
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

// Item type definition
interface Item {
  id: string;
  type: "folder" | "quiz" | "other";
  name: string;
  description?: string;
  generation_status?: "pending" | "success" | "failed" | null;
  [key: string]: any;
}

// SortableItem component for drag-and-drop functionality
interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

// GenericGridProps for defining component props
interface GenericGridProps {
  items: Item[];
  selectedItems: string[];
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>;
  renderItem: (item: Item, isSelected: boolean, onClick: (e: React.MouseEvent) => void) => React.ReactNode;
  onReorder?: (newOrder: Item[]) => void;
}

// SortableItem implementation
function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? "grabbing" : "grab",
    outline: "none",
    height: "100%",
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (e.button === 0) document.body.style.userSelect = "none";
  };

  const handlePointerUp = () => {
    document.body.style.userSelect = "";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="h-full"
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

// GenericGrid component
export default function GenericGrid({
  items,
  selectedItems,
  setSelectedItems,
  renderItem,
  onReorder,
}: GenericGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newOrder = arrayMove(items, oldIndex, newIndex);
    onReorder?.(newOrder);
  };

  const handleItemClick = (itemId: string) => {
    const isSelected = selectedItems.includes(itemId);
    if (isSelected) {
      setSelectedItems((prev: string[]) => prev.filter((id) => id !== itemId));
    } else {
      setSelectedItems((prev: string[]) => [...prev, itemId]);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch [grid-auto-rows:1fr]">
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {renderItem(item, selectedItems.includes(item.id), () => handleItemClick(item.id))}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
