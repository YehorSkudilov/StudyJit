import { AlertTriangle, BookOpen, Sparkles } from "lucide-react";
import ScoreRing from "@/components/ui/ScoreRing";
import GenerationProgress, { type GenerationProgressInfo } from "@/components/GenerationProgress";

interface QuizCardProps {
  quizName: string;
  description?: string | null;
  lastScore?: number | null;
  status?: string | null;
  questionCount?: number;
  progress?: GenerationProgressInfo | null;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

/** A quiz in the learning space: its state at a glance (ready, generating, failed) and the last score. */
export default function QuizCard({
  quizName,
  description,
  lastScore,
  status,
  questionCount = 0,
  progress,
  selected,
  onClick,
  onDoubleClick,
}: QuizCardProps) {
  const generating = status === "queued" || status === "pending";
  return (
    <div
      className={`card card-hover group relative h-full p-5 flex flex-col gap-3 cursor-pointer overflow-hidden ${
        selected ? "ring-2 ring-brand border-brand" : ""
      }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-brand-2 opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-2">
        <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5" />
        </span>
        {lastScore != null && <ScoreRing percent={Number(lastScore)} size={44} stroke={5} animated={false} />}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-bold leading-snug line-clamp-2 break-words">{quizName}</h3>
        {description && <p className="mt-1 text-xs text-muted line-clamp-2">{description}</p>}
      </div>

      {generating && <GenerationProgress progress={progress} status={status} compact />}

      <div className="flex items-center gap-2 text-xs">
        {generating ? null : status === "failed" ? (
          <span className="chip bg-red-500/15 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3 h-3" /> Failed
          </span>
        ) : questionCount > 0 ? (
          <span className="chip bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            {questionCount} questions
          </span>
        ) : (
          <span className="chip bg-surface-2 text-muted">
            <Sparkles className="w-3 h-3" /> Set up
          </span>
        )}
        {lastScore == null && questionCount > 0 && !generating && <span className="text-muted">Not studied yet</span>}
      </div>
    </div>
  );
}
