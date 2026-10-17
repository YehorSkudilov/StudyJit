"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";

interface FloatingAddButtonProps {
  onClick: () => void;
}

export default function FloatingAddButton({ onClick }: FloatingAddButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.08, rotate: 90 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-[0_12px_30px_-8px_rgba(29,111,216,0.7)] flex items-center justify-center"
      title="Add new"
      aria-label="Add new"
    >
      <Plus className="w-7 h-7" />
    </motion.button>
  );
}
