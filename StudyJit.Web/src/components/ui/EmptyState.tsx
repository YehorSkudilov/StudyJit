"use client";

import { motion } from "framer-motion";
import { Plus, type LucideIcon } from "lucide-react";

/** What an empty page shows: what goes here, and the button to add it. */
export default function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card border-dashed flex flex-col items-center text-center px-6 py-16"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand to-brand-2 blur-xl opacity-30" />
        <span className="relative w-16 h-16 rounded-3xl bg-gradient-to-br from-brand to-brand-2 text-white flex items-center justify-center animate-float">
          <Icon className="w-8 h-8" />
        </span>
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-2 text-muted max-w-md">{text}</p>
      {action && onAction && (
        <button onClick={onAction} className="btn-primary mt-6">
          <Plus className="w-4 h-4" /> {action}
        </button>
      )}
    </motion.div>
  );
}
