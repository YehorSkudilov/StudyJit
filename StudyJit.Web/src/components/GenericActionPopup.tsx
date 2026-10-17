"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Modal from "@/components/ui/Modal";

export interface ActionItem {
  key: string;
  title: string;
  subtitle?: string;
  color?: "blue" | "green" | "yellow" | "purple" | "red";
  icon: React.ElementType;
  onClick: () => void;
}

interface GenericActionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionItem[];
}

const gradients = {
  blue: "from-brand to-brand-2",
  green: "from-emerald-500 to-teal-400",
  yellow: "from-amber-400 to-orange-500",
  purple: "from-violet-500 to-fuchsia-500",
  red: "from-rose-500 to-red-500",
};

export default function GenericActionPopup({ isOpen, onClose, title = "Choose Action", actions }: GenericActionPopupProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        {actions.map((action, i) => (
          <motion.button
            key={action.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06 }}
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className="group flex items-center gap-4 p-4 rounded-2xl border border-stroke bg-surface hover:border-brand/40 hover:bg-surface-2 transition active:scale-[0.98] text-left"
          >
            <span
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradients[action.color || "blue"]} text-white flex items-center justify-center flex-shrink-0 shadow-md transition group-hover:scale-110`}
            >
              <action.icon className="w-6 h-6" />
            </span>
            <span className="flex-1">
              <span className="block font-bold">{action.title}</span>
              {action.subtitle && <span className="block text-sm text-muted">{action.subtitle}</span>}
            </span>
            <ChevronRight className="w-5 h-5 text-muted transition group-hover:translate-x-1" />
          </motion.button>
        ))}
      </div>
    </Modal>
  );
}
