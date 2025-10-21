"use client";
import React, { useRef, useEffect, useState, useMemo } from "react";
import { Item } from "@/types/Item";
import {
  rectIntersection,
  type CollisionDescriptor,
  type CollisionDetection,
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
    touchAction: "none",
    userSelect: "none",
    outline: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={-1}
      className="[&:focus]:outline-none [&:focus-visible]:outline-none"
      data-item-id={id} // important for mobile drag-select
    >
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

/* -------------------- Collision Detection -------------------- */
const strictIntersection: CollisionDetection = (args) => {
  const intersections = rectIntersection(args) as CollisionDescriptor[];
  return intersections.filter(
    (entry) =>
      typeof entry.data?.value === "number" && entry.data.value > 0.1
  );
};

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
  onDropOnFolder?: (
    source: Item | Item[],
    destinationFolderId: string
  ) => void | Promise<void>;
  onDropToParent?: (source: Item | Item[]) => void | Promise<void>;
  context?: "files" | "quizzes";
}) {
  /* -------------------- Prevent text selection -------------------- */
  useEffect(() => {
    const preventSelection = (e: Event) => e.preventDefault();
    const enableBlock = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        document.addEventListener("selectstart", preventSelection);
        document.body.style.userSelect = "none";
      }
    };
    const disableBlock = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        document.removeEventListener("selectstart", preventSelection);
        document.body.style.userSelect = "";
      }
    };
    document.addEventListener("keydown", enableBlock);
    document.addEventListener("keyup", disableBlock);
    return () => {
      document.removeEventListener("keydown", enableBlock);
      document.removeEventListener("keyup", disableBlock);
      document.removeEventListener("selectstart", preventSelection);
      document.body.style.userSelect = "";
    };
  }, []);

  /* -------------------- Sensors -------------------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const lastClickedIndex = useRef<number | null>(null);
  const [draggingItems, setDraggingItems] = useState<Item[]>([]);
  const [isOverFolder, setIsOverFolder] = useState(false);
  const [showDropZone, setShowDropZone] = useState(false);

  // Mobile select state
  const [touchSelecting, setTouchSelecting] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"add" | "remove" | null>(null);

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
    if (!active || !over || active.id === over.id) return;
    const overItem = over?.data?.current?.item as Item | undefined;

    if (over.id === "drop-to-parent") {
      for (const item of draggingItems) await onDropToParent?.(item);
      return;
    }

    if (overItem?.type === "folder") {
      for (const item of draggingItems) {
        if (item.id !== overItem.id) await onDropOnFolder?.(item, overItem.id);
      }
      return;
    }

    const activeItem = active.data?.current?.item as Item | undefined;
    if (!activeItem || !overItem) return;
    const oldIndex = items.findIndex((i) => i.id === activeItem.id);
    const newIndex = items.findIndex((i) => i.id === overItem.id);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    const newOrder = arrayMove(items, oldIndex, newIndex);
    onReorder?.(newOrder);
  };

  /* -------------------- Touch Select (Mobile) -------------------- */
  useEffect(() => {
    if (!touchSelecting) return;
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const id = el?.closest("[data-item-id]")?.getAttribute("data-item-id");
      if (!id) return;

      setSelectedItems((prev) => {
        if (selectionMode === "add" && !prev.includes(id)) return [...prev, id];
        if (selectionMode === "remove" && prev.includes(id))
          return prev.filter((x) => x !== id);
        return prev;
      });
    };
    window.addEventListener("touchmove", handleTouchMove);
    return () => window.removeEventListener("touchmove", handleTouchMove);
  }, [touchSelecting, selectionMode]);

  /* -------------------- Selection -------------------- */
  const handleItemClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    const index = visibleItems.findIndex((i) => i.id === itemId);
    const isSelected = selectedItems.includes(itemId);

    if (e.shiftKey && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      const range = visibleItems.slice(start, end + 1).map((i) => i.id);
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

  /* -------------------- Sort visible items -------------------- */
  const visibleItems = useMemo(() => {
    const base =
      draggingItems.length === 0
        ? items
        : items.filter((i) => !draggingItems.some((d) => d.id === i.id));

    return [...base].sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [items, draggingItems]);

  const mainDragged = draggingItems[0];

  /* -------------------- Render -------------------- */
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={strictIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <AnimatePresence>{showDropZone && <DropToParentZone />}</AnimatePresence>

      <SortableContext
        items={!isOverFolder ? visibleItems.map((i) => i.id) : []}
        strategy={rectSortingStrategy}
      >
        <div
          className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 items-stretch [grid-auto-rows:1fr] select-none"
          onTouchEnd={() => setTouchSelecting(false)}
        >
          {visibleItems.map((item) => {
            const isSelected = selectedItems.includes(item.id);
            const content = renderItem(item, isSelected, (e) =>
              handleItemClick(e, item.id)
            );

            return (
              <SortableItem key={item.id} id={item.id} item={item}>
                <div
                  data-item-id={item.id}
                  onTouchStart={(e) => {
                    const timer = setTimeout(() => {
                      const already = selectedItems.includes(item.id);
                      setTouchSelecting(true);
                      setSelectionMode(already ? "remove" : "add");
                      setSelectedItems((prev) =>
                        already
                          ? prev.filter((x) => x !== item.id)
                          : [...prev, item.id]
                      );
                    }, 350);
                    (e.target as any)._longPressTimer = timer;
                  }}
                  onTouchEnd={(e) => {
                    clearTimeout((e.target as any)._longPressTimer);
                  }}
                >
                  <FolderDropWrapper
                    id={item.id}
                    onHoverChange={(hover) => setIsOverFolder(hover)}
                  >
                    {content}
                  </FolderDropWrapper>
                </div>
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
            className="relative shadow-2xl rounded-xl pointer-events-none select-none"
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
