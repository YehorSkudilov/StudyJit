"use client";

import { AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";

interface AlertAction {
  label: string;
  color?: "blue" | "red" | "gray";
  onClick: () => void;
}

interface AlertPopupProps {
  message: string;
  onClose: () => void;
  actions?: AlertAction[]; // optional multiple buttons
}

const buttonClass = { blue: "btn-primary", red: "btn-danger", gray: "btn-secondary" };

export default function AlertPopup({ message, onClose, actions }: AlertPopupProps) {
  return (
    <Modal isOpen onClose={onClose} width="max-w-sm">
      <div className="flex flex-col items-center text-center gap-4 pt-2">
        <div className="w-14 h-14 rounded-2xl bg-amber-400/15 text-amber-500 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <p className="text-base font-medium whitespace-pre-line">{message}</p>
        <div className="flex w-full gap-3">
          {actions && actions.length > 0 ? (
            actions.map((action) => (
              <button key={action.label} onClick={action.onClick} className={`${buttonClass[action.color ?? "blue"]} flex-1`}>
                {action.label}
              </button>
            ))
          ) : (
            <button onClick={onClose} className="btn-primary flex-1">
              OK
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
