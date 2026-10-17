"use client";

import { AlertCircle, BookPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import Modal from "@/components/ui/Modal";

type CreateQuizPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateQuiz: (quizName: string, description?: string) => Promise<void> | void;
};

export default function CreateQuizPopup({ isOpen, onClose, onCreateQuiz }: CreateQuizPopupProps) {
  const [quizName, setQuizName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizName.trim()) {
      setError("Give your study set a name.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onCreateQuiz(quizName.trim(), description.trim());
      setQuizName("");
      setDescription("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create quiz.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    setQuizName("");
    setDescription("");
    setError("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      locked={isSubmitting}
      title="New study set"
      icon={<BookPlus className="w-5 h-5" />}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Name</label>
          <input
            type="text"
            placeholder="e.g. Cell Biology, Chapter 3"
            value={quizName}
            onChange={(e) => setQuizName(e.target.value)}
            disabled={isSubmitting}
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <textarea
            placeholder="What's it about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            className="input resize-none h-24"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <p className="text-xs text-muted">Next you&apos;ll add your files and let the AI build questions, flashcards and a study guide.</p>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookPlus className="w-5 h-5" />}
          {isSubmitting ? "Creating…" : "Create study set"}
        </button>
      </form>
    </Modal>
  );
}
