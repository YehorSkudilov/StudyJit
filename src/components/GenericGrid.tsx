"use client";
import React, { useRef, useEffect, useState, useMemo } from "react";
import { Item } from "@/types/Item";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";

/* -------------------- SortableItem -------------------- */
function SortableItem({
  id,
  item,
  children,
  disableSort,
}: {
  id: string;
  item: Item;
  children: React.ReactNode;
  disableSort?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      data: { item },
      disabled: !!disableSort,
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: disableSort ? "pointer" : isDragging ? "grabbing" : "grab",
    height: "100%",
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

/* -------------------- DropToParentZone -------------------- */
function DropToParentZone() {
  const { setNodeRef, isOver } = useDroppable({ id: "drop-to-parent" });
  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className={`w-full h-14 mb-4 flex items-center justify-center rounded-lg border-2 border-dashed transition
        ${
          isOver
            ? "border-blue-500 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
            : "border-gray-400/50 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
    >
      Drop here to move up one level
    </motion.div>
  );
}

/* -------------------- FolderDropWrapper -------------------- */
function FolderDropWrapper({
  id,
  children,
  onHoverChange,
}: {
  id: string;
  children: React.ReactNode;
  onHoverChange?: (hover: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  useEffect(() => {
    onHoverChange?.(isOver);
  }, [isOver]);
  return (
    <div
      ref={setNodeRef}
      className={`transition rounded-xl ${
        isOver
          ? "ring-4 ring-blue-400 ring-offset-2 dark:ring-blue-500 scale-[1.02]"
          : "ring-0"
      }`}
    >
      {children}
    </div>
  );
}

/* -------------------- GenericGrid -------------------- */
export default function GenericGrid({
  items,
  selectedItems,
  setSelectedItems,
  renderItem,
  onReorder,
  onDropOnFolder,
  onDropToParent,
  context = "files",
}: {
  items: Item[];
  selectedItems: string[];
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>;
  renderItem: (
    item: Item,
    isSelected: boolean,
    onClick: (e: React.MouseEvent) => void
  ) => React.ReactNode;
  onReorder?: (newOrder: Item[]) => void;
  onDropOnFolder?: (source: Item | Item[], destinationFolderId: string) => void | Promise<void>;
  onDropToParent?: (source: Item | Item[]) => void | Promise<void>;
  context?: "files" | "quizzes";
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const lastClickedIndex = useRef<number | null>(null);
  const [draggingItems, setDraggingItems] = useState<Item[]>([]);
  const [isOverFolder, setIsOverFolder] = useState(false);
  const [showDropZone, setShowDropZone] = useState(false);

  /* -------------------- Drag Events -------------------- */
  const handleDragStart = (evt: DragStartEvent) => {
    const draggedItem = evt.active.data?.current?.item as Item | undefined;
    if (!draggedItem) return;

    if (selectedItems.includes(draggedItem.id) && selectedItems.length > 1) {
      const selected = items.filter((i) => selectedItems.includes(i.id));
      setDraggingItems(selected);
    } else {
      setDraggingItems([draggedItem]);
    }
  };

  const handleDragOver = (evt: DragOverEvent) => {
    const overId = evt.over?.id?.toString();
    const hoveredItem = items.find((i) => i.id === overId);
    setIsOverFolder(hoveredItem?.type === "folder");
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setIsOverFolder(false);
    setDraggingItems([]);
    setShowDropZone(false);

    if (!active || !over) return;
    const overItem = over?.data?.current?.item as Item;
    const isMulti = draggingItems.length > 1;

    // ✅ Drop onto parent zone
    if (over.id === "drop-to-parent") {
      for (const item of draggingItems) await onDropToParent?.(item);
      return;
    }

    // ✅ Drop onto folder
    if (overItem?.type === "folder") {
      for (const item of draggingItems) {
        if (item.id !== overItem.id) await onDropOnFolder?.(item, overItem.id);
      }
      return;
    }

    // ✅ Reordering
    if (!isMulti && !isOverFolder) {
      const activeItem = active.data?.current?.item as Item;
      if (!activeItem) return;
      const oldIndex = items.findIndex((i) => i.id === activeItem.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(items, oldIndex, newIndex);
        onReorder?.(newOrder);
      }
    }
  };

  /* -------------------- Delay the drop zone -------------------- */
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (draggingItems.length > 0) {
      timer = setTimeout(() => setShowDropZone(true), 400);
    } else {
      setShowDropZone(false);
    }
    return () => clearTimeout(timer);
  }, [draggingItems.length]);

  /* -------------------- Selection -------------------- */
  const handleItemClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    const index = items.findIndex((i) => i.id === itemId);
    const isSelected = selectedItems.includes(itemId);

    if (e.shiftKey && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      const range = items.slice(start, end + 1).map((i) => i.id);
      setSelectedItems((prev) => Array.from(new Set([...prev, ...range])));
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedItems((prev) =>
        isSelected ? prev.filter((id) => id !== itemId) : [...prev, itemId]
      );
      lastClickedIndex.current = index;
    } else {
      setSelectedItems(isSelected && selectedItems.length === 1 ? [] : [itemId]);
      lastClickedIndex.current = index;
    }
  };

  /* -------------------- Render -------------------- */
// ✅ Automatically sort items alphabetically by name
const visibleItems = useMemo(() => {
  const base = draggingItems.length === 0
    ? items
    : items.filter((i) => !draggingItems.some((d) => d.id === i.id));

  // Sort folders first, then files, both alphabetically by name
  return [...base].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}, [items, draggingItems]);


  const mainDragged = draggingItems[0];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <AnimatePresence>{showDropZone && <DropToParentZone />}</AnimatePresence>

      <SortableContext
        items={!isOverFolder ? visibleItems.map((i) => i.id) : []}
        strategy={rectSortingStrategy}
      >
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch [grid-auto-rows:1fr] select-none">
  {visibleItems.map((item) => {
    const isSelected = selectedItems.includes(item.id);
    const content = renderItem(item, isSelected, (e) =>
      handleItemClick(e, item.id)
    );

    return (
      <SortableItem key={item.id} id={item.id} item={item}>
        <FolderDropWrapper
          id={item.id}
          onHoverChange={(hover) => setIsOverFolder(hover)}
        >
          {content}
        </FolderDropWrapper>
      </SortableItem>
    );
  })}
</div>


      </SortableContext>

      {/* 🌟 Drag Overlay */}
      <DragOverlay adjustScale={false} style={{ transformOrigin: "top left" }}>
        {draggingItems.length > 0 && mainDragged && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative shadow-2xl rounded-xl pointer-events-none"
          >
            {renderItem(mainDragged, true, () => {})}
            {draggingItems.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow-md">
                +{draggingItems.length - 1} more
              </div>
            )}
          </motion.div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
