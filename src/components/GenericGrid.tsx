"use client";
import React, { useRef, useEffect } from "react";
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

/* -------------------- SortableItem -------------------- */
function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? "grabbing" : "pointer",
    height: "100%",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // Prevent text selection highlight on shift/drag
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

/* -------------------- GenericGrid (with multi-select) -------------------- */
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

  const lastClickedIndex = useRef<number | null>(null);

  useEffect(() => {
    // Disable global text selection inside the grid while clicking
    const preventSelect = (e: Event) => e.preventDefault();
    document.addEventListener("selectstart", preventSelect);
    return () => document.removeEventListener("selectstart", preventSelect);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newOrder = arrayMove(items, oldIndex, newIndex);
    onReorder?.(newOrder);
  };

  const handleItemClick = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault(); // stop native highlight
    const index = items.findIndex((i) => i.id === itemId);
    const isSelected = selectedItems.includes(itemId);

    // ✅ SHIFT — Select range
    if (e.shiftKey && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      const range = items.slice(start, end + 1).map((i) => i.id);
      const newSelected = Array.from(new Set([...selectedItems, ...range]));
      setSelectedItems(newSelected);
    }

    // ✅ CTRL/CMD — Toggle single
    else if (e.ctrlKey || e.metaKey) {
      if (isSelected)
        setSelectedItems((prev) => prev.filter((id) => id !== itemId));
      else setSelectedItems((prev) => [...prev, itemId]);
      lastClickedIndex.current = index;
    }

    // ✅ Normal click — Select single
    else {
      if (isSelected && selectedItems.length === 1) setSelectedItems([]);
      else setSelectedItems([itemId]);
      lastClickedIndex.current = index;
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch [grid-auto-rows:1fr] select-none"
          // Disable drag-select region highlight
          onMouseDown={(e) => e.preventDefault()}
        >
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
