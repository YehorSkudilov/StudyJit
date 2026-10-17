"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel. */
  width?: string;
  /** Stops Escape and the backdrop from closing it, e.g. while saving. */
  locked?: boolean;
}

/** A centered dialog that fades and springs in, and closes on Escape or a click outside. */
export default function Modal({ isOpen, onClose, title, icon, children, width = "max-w-md", locked }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, locked, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[6000] flex items-center justify-center px-4 bg-slate-950/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !locked) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`card w-full ${width} max-h-[88vh] overflow-y-auto p-6 flex flex-col gap-5`}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            {title && (
              <div className="flex items-center gap-3">
                {icon && (
                  <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
                    {icon}
                  </div>
                )}
                <h2 className="text-lg font-bold flex-1">{title}</h2>
                <button className="icon-btn -mr-2" onClick={onClose} disabled={locked} aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
