"use client";
import React, { useRef, useEffect, useState, useMemo } from "react";
import { Item } from "@/types/Item";
import {
  rectIntersection,
  type CollisionDescriptor,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
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
    outline: "none", // ✅ remove blue border
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={-1} // ✅ prevent focus outline from appearing on Shift-click
      className="[&:focus]:outline-none [&:focus-visible]:outline-none"
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
            ? "border-brand bg-brand-soft text-brand"
            : "border-stroke text-muted"
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
      className={`h-full transition rounded-2xl ${
        isOver
          ? "ring-4 ring-brand/60 ring-offset-2 ring-offset-background scale-[1.03]"
          : "ring-0"
      }`}
    >
      {children}
    </div>
  );
}

/* -------------------- Custom Collision Detection -------------------- */
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
  emptyState,
  onOpen,
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
  /** Shown instead of the grid when there's nothing in it. */
  emptyState?: React.ReactNode;
  /** A plain click (no modifier keys, nothing selected) opens the item instead of selecting it; return false to select it after all. */
  onOpen?: (item: Item) => boolean | void;
}) {
  /* -------------------- Prevent browser text selection -------------------- */
  useEffect(() => {
    const preventSelection = (e: Event) => e.preventDefault();

    const enableBlock = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        document.addEventListener("selectstart", preventSelection);
        document.addEventListener("mousedown", preventSelection);
        document.body.style.userSelect = "none";
      }
    };

    const disableBlock = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        document.removeEventListener("selectstart", preventSelection);
        document.removeEventListener("mousedown", preventSelection);
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("keydown", enableBlock);
    document.addEventListener("keyup", disableBlock);

    return () => {
      document.removeEventListener("keydown", enableBlock);
      document.removeEventListener("keyup", disableBlock);
      document.removeEventListener("selectstart", preventSelection);
      document.removeEventListener("mousedown", preventSelection);
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

  /* -------------------- Delay drop zone -------------------- */
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (draggingItems.length > 0) timer = setTimeout(() => setShowDropZone(true), 400);
    else setShowDropZone(false);
    return () => clearTimeout(timer);
  }, [draggingItems.length]);

/* -------------------- Selection -------------------- */
const anchorIdRef = useRef<string | null>(null);   // persistent anchor for Shift ranges
const lastFocusedIdRef = useRef<string | null>(null); // optional (for accessibility/focus)

const handleItemClick = (e: React.MouseEvent, itemId: string) => {
  e.stopPropagation();
  const isSelected = selectedItems.includes(itemId);

  if (onOpen && !e.shiftKey && !e.ctrlKey && !e.metaKey && selectedItems.length === 0) {
    const item = items.find((i) => i.id === itemId);
    if (item && onOpen(item) !== false) return;
  }

  const idxOf = (id: string | null) =>
    id ? visibleItems.findIndex((i) => i.id === id) : -1;

  const currentIndex = idxOf(itemId);
  let anchorIndex = idxOf(anchorIdRef.current);

  // If there is no anchor yet, start it at the current item
  if (anchorIndex === -1) {
    anchorIdRef.current = itemId;
    anchorIndex = currentIndex;
  }

  if (e.shiftKey) {
    // Compute range between anchor and current
    const start = Math.min(anchorIndex, currentIndex);
    const end = Math.max(anchorIndex, currentIndex);
    const rangeIds = visibleItems.slice(start, end + 1).map((i) => i.id);

    if (e.ctrlKey || e.metaKey) {
      // Additive range
      setSelectedItems((prev) => Array.from(new Set([...prev, ...rangeIds])));
    } else {
      // Replace with the range (Finder/Explorer behavior)
      setSelectedItems(rangeIds);
    }

    // IMPORTANT: do NOT move the anchor on Shift-click
    lastFocusedIdRef.current = itemId;
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    // Toggle single item
    setSelectedItems((prev) =>
      isSelected ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
    // Update anchor to this item (Windows/Finder do this)
    anchorIdRef.current = itemId;
    lastFocusedIdRef.current = itemId;
    return;
  }

  // Plain click: single-select (or clear if it's the same sole item)
  setSelectedItems(isSelected && selectedItems.length === 1 ? [] : [itemId]);
  anchorIdRef.current = itemId;        // move anchor on normal click
  lastFocusedIdRef.current = itemId;
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
        {items.length === 0 && emptyState}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 items-stretch [grid-auto-rows:1fr] select-none">
          {visibleItems.map((item, index) => {
            const isSelected = selectedItems.includes(item.id);
            const content = renderItem(item, isSelected, (e) =>
              handleItemClick(e, item.id)
            );

            return (
              <SortableItem key={item.id} id={item.id} item={item}>
                <motion.div
                  className="h-full"
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: Math.min(index, 12) * 0.035, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <FolderDropWrapper
                    id={item.id}
                    onHoverChange={(hover) => setIsOverFolder(hover)}
                  >
                    {content}
                  </FolderDropWrapper>
                </motion.div>
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
              <div className="absolute bottom-2 right-2 bg-brand text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                +{draggingItems.length - 1} more
              </div>
            )}
          </motion.div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
