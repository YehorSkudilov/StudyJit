import { PlusCircle } from "lucide-react";

interface FloatingAddButtonProps {
  onClick: () => void;
}

export default function FloatingAddButton({ onClick }: FloatingAddButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition flex items-center justify-center"
      title="Add New"
    >
      <PlusCircle className="w-6 h-6" />
    </button>
  );
}
