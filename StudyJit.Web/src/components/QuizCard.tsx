import { CheckCircle } from "lucide-react";

interface QuizCardProps {
  quizName: string;
  lastScore?: number | null; // ✅ new prop for score
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export default function QuizCard({
  quizName,
  lastScore,
  selected,
  onClick,
  onDoubleClick,
}: QuizCardProps) {
  return (
    <div
      className={`p-6 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col gap-3 transition-colors hover:bg-blue-50 dark:hover:bg-gray-700 hover:shadow-md cursor-pointer
        ${selected ? "ring-2 ring-blue-500" : ""}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-500" />
        <h3 className="font-semibold truncate">{quizName}</h3>
      </div>

      {lastScore !== null && lastScore !== undefined ? (
        <p className="text-gray-700 dark:text-gray-300 text-sm">
          Last Score:{" "}
          <span
            className={`font-semibold ${
              lastScore >= 80
                ? "text-green-600"
                : lastScore >= 50
                ? "text-yellow-500"
                : "text-red-500"
            }`}
          >
            {lastScore}%
          </span>
        </p>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm italic">
          No score available
        </p>
      )}
    </div>
  );
}
