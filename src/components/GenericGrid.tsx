"use client";
import React, { useRef } from "react";
import { Item } from "@/types/Item";

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

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

interface GenericGridProps {
  items: Item[];
  selectedItems: string[];
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>;
  renderItem: (
    item: Item,
    isSelected: boolean,
    onClick: (e: React.MouseEvent) => void
  ) => React.ReactNode;
  onReorder?: (newOrder: Item[]) => void;
}

// SortableItem implementation
function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

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

// ✅ GenericGrid with Shift-Select
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

  // remember last clicked index for shift-range
  const lastClickedIndex = useRef<number | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newOrder = arrayMove(items, oldIndex, newIndex);
    onReorder?.(newOrder);
  };

  const handleItemClick = (e: React.MouseEvent, itemId: string) => {
    const index = items.findIndex((i) => i.id === itemId);
    const isSelected = selectedItems.includes(itemId);

    if (e.shiftKey && lastClickedIndex.current !== null) {
      // ✅ SHIFT select range
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      const rangeIds = items.slice(start, end + 1).map((i) => i.id);
      const merged = Array.from(new Set([...selectedItems, ...rangeIds]));
      setSelectedItems(merged);
    } else if (e.metaKey || e.ctrlKey) {
      // ✅ CMD/Ctrl toggle single
      if (isSelected)
        setSelectedItems((prev) => prev.filter((id) => id !== itemId));
      else setSelectedItems((prev) => [...prev, itemId]);
      lastClickedIndex.current = index;
    } else {
      // ✅ Normal click
      if (isSelected && selectedItems.length === 1) {
        setSelectedItems([]);
      } else {
        setSelectedItems([itemId]);
      }
      lastClickedIndex.current = index;
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch [grid-auto-rows:1fr]">
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {renderItem(
                item,
                selectedItems.includes(item.id),
                (e) => handleItemClick(e, item.id)
              )}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
