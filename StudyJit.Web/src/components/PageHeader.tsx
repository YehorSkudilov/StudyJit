"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  Trash2,
  CheckSquare,
  XSquare,
  Pencil,
  Check,
  LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/* -------------------- Types -------------------- */
interface ExtraAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: "blue" | "red" | "green" | "yellow";
}

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
  activeFolder?: string | null;
  canRename?: boolean;
  onRename?: (newName: string) => Promise<void>;
  goBack?: () => void;
  showBack?: boolean;
  selectedItems?: string[];
  onDeleteSelected?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  extraActions?: ExtraAction[];
  children?: React.ReactNode;
  color?: "blue" | "yellow" | "green" | "red";
}

/* -------------------- Component -------------------- */
export default function PageHeader({
  title,
  icon: Icon,
  activeFolder,
  canRename = false,
  onRename,
  goBack,
  showBack = false,
  selectedItems = [],
  onDeleteSelected,
  onSelectAll,
  onDeselectAll,
  extraActions = [],
  children,
  color = "blue",
}: PageHeaderProps) {
  const hasSelection = selectedItems.length > 0;
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(activeFolder || title);

  // keep rename input synced with latest folder name
  useEffect(() => {
    setNewName(activeFolder || title);
  }, [activeFolder, title]);

  // reset rename mode when navigating to another folder
  useEffect(() => {
    setEditing(false);
  }, [activeFolder]);

  const handleRenameConfirm = async () => {
    if (newName.trim() && onRename) {
      await onRename(newName.trim());
      setEditing(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleRenameConfirm();
    } else if (e.key === "Escape") {
      setEditing(false);
      setNewName(activeFolder || title);
    }
  };

  const colorClasses = {
    blue: "bg-brand-soft text-brand",
    yellow: "bg-amber-400/15 text-amber-500",
    green: "bg-emerald-500/15 text-emerald-500",
    red: "bg-red-500/15 text-red-500",
  };

  const actionClass = (color?: ExtraAction["color"]) =>
    color === "red"
      ? "hover:bg-red-500/10 hover:text-red-500"
      : color === "green"
      ? "hover:bg-emerald-500/10 hover:text-emerald-500"
      : color === "yellow"
      ? "hover:bg-amber-400/10 hover:text-amber-500"
      : "hover:bg-brand-soft hover:text-brand";

  return (
    <section className="mx-auto max-w-7xl w-full px-4 sm:px-6 pt-8 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {showBack && goBack && (
            <button onClick={goBack} className="icon-btn" title="Go back">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {Icon && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${colorClasses[color]}`}
            >
              <Icon className="w-5 h-5" />
            </motion.span>
          )}

          {!editing ? (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">{activeFolder || title}</h1>
              {canRename && (
                <button onClick={() => setEditing(true)} title="Rename folder" className="icon-btn w-8 h-8">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                className="input py-1.5 w-48 sm:w-72"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <button onClick={handleRenameConfirm} className="icon-btn text-emerald-500" title="Confirm rename">
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setNewName(activeFolder || title);
                }}
                className="icon-btn"
                title="Cancel"
              >
                <XSquare className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto rounded-full border border-stroke bg-surface p-1 shadow-sm">
          <AnimatePresence>
            {hasSelection && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="px-3 text-sm font-semibold text-brand whitespace-nowrap overflow-hidden"
              >
                {selectedItems.length} selected
              </motion.span>
            )}
          </AnimatePresence>

          {hasSelection && onDeleteSelected && (
            <button onClick={onDeleteSelected} className={`icon-btn ${actionClass("red")}`} title="Delete selected">
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {extraActions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`icon-btn ${actionClass(action.color)}`}
              title={action.label}
            >
              <action.icon className="w-4 h-4" />
            </button>
          ))}

          {onSelectAll && (
            <button onClick={onSelectAll} className={`icon-btn ${actionClass("blue")}`} title="Select all">
              <CheckSquare className="w-4 h-4" />
            </button>
          )}

          {onDeselectAll && (
            <button onClick={onDeselectAll} disabled={!hasSelection} className="icon-btn" title="Deselect all">
              <XSquare className="w-4 h-4" />
            </button>
          )}

          {children}
        </div>
      </div>
    </section>
  );
}
