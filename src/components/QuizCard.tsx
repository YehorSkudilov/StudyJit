import { CheckCircle } from "lucide-react";

interface QuizCardProps {
  quizName: string;
  score: number;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export default function QuizCard({ quizName, score, selected, onClick, onDoubleClick }: QuizCardProps) {
  return (
    <div
      className={`p-6 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col gap-3 transition-colors hover:bg-blue-50 dark:hover:bg-gray-700 hover:shadow-md cursor-pointer
        ${selected ? "ring-2 ring-blue-500" : ""}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-500" />
        <h3 className="font-semibold">{quizName}</h3>
      </div>
      <p className="text-gray-600 dark:text-gray-300">Score: {score}%</p>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
