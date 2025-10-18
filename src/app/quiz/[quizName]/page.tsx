"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import AlertPopup from "@/components/AlertPopup";

// 🎲 Utility: Shuffle array in-place
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface Question {
  id: number;
  question: string;
  options: string[];
  correct: string; // holds TEXT of correct answer
}

export default function QuizPage() {
  const router = useRouter();
  const { quizName } = useParams();
  const decodedQuizName = decodeURIComponent(quizName as string);

  const [quizId, setQuizId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // ✅ Fetch quiz
  useEffect(() => {
    const storedId = sessionStorage.getItem("selectedQuizId");
    if (!storedId) {
      setShowPopup(true);
      setTimeout(() => router.push("/dashboard"), 2000);
      return;
    }

    const id = Number(storedId);
    setQuizId(id);

    const fetchQuiz = async () => {
      try {
        const res = await fetch(`/api/db/getQuiz/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load quiz");

        // 🎲 Randomize both questions and options
        const shuffledQuestions = shuffleArray(
          (data.questions || []).map((q: Question) => ({
            ...q,
            options: shuffleArray(q.options),
          }))
        );

        setQuestions(shuffledQuestions);
        setDescription(data.description || "");
      } catch (err) {
        console.error("❌ Error fetching quiz:", err);
        setShowPopup(true);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [router]);

  const selectAnswer = (qid: number, option: string) => {
    if (submitted) return;
    setAnswers({ ...answers, [qid]: option });
  };

  const getCorrectAnswerIndex = (q: Question): number => {
    return q.options.findIndex(
      (opt) => opt.trim().toLowerCase() === q.correct.trim().toLowerCase()
    );
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      setShowPopup(true);
      return;
    }

    let total = 0;
    questions.forEach((q) => {
      const correctIndex = getCorrectAnswerIndex(q);
      const selectedIndex = q.options.indexOf(answers[q.id]);
      if (selectedIndex === correctIndex) total++;
    });

    setScore(total);
    setSubmitted(true);
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);

    // 🎲 Re-shuffle quiz again on retry
    setQuestions((prev) =>
      shuffleArray(prev.map((q) => ({ ...q, options: shuffleArray(q.options) })))
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-lg text-gray-700 dark:text-gray-200">
        Loading quiz...
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen text-lg text-gray-700 dark:text-gray-200">
        ❌ No questions found for this quiz.
      </div>
    );
  }

  return (
    <>
      {showPopup && (
        <AlertPopup
          message="Please answer all questions before submitting."
          onClose={() => setShowPopup(false)}
        />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col px-3 sm:px-8 md:px-20 py-6 sm:py-10 gap-6">
        <div className="relative p-4 sm:p-8 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col gap-6 max-w-4xl w-full mx-auto">

          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Header */}
          <header className="flex flex-col items-center text-center mt-4 sm:mt-0 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2 leading-tight">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
              {decodedQuizName}
            </h1>
            {description && (
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-[90%]">
                {description}
              </p>
            )}
          </header>

          {/* Questions */}
          <div className="flex flex-col gap-5 sm:gap-6">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className={`p-4 sm:p-5 rounded-lg border transition-colors ${
                  submitted
                    ? "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                }`}
              >
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                  {idx + 1}. {q.question}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {q.options.map((opt) => {
                    const isSelected = answers[q.id] === opt;
                    const isCorrect =
                      opt.trim().toLowerCase() ===
                      q.correct.trim().toLowerCase();
                    const showCorrect =
                      submitted &&
                      ((isCorrect && isSelected) || (!isSelected && isCorrect));
                    const showIncorrect =
                      submitted && isSelected && !isCorrect;

                    return (
                      <button
                        key={opt}
                        onClick={() => selectAnswer(q.id, opt)}
                        className={`flex items-center justify-between w-full px-3 sm:px-4 py-2 sm:py-3 text-left rounded-lg border transition text-sm sm:text-base
                          ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/40"
                              : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                          }
                          ${
                            showCorrect
                              ? "bg-green-100 dark:bg-green-900/40 border-green-500"
                              : ""
                          }
                          ${
                            showIncorrect
                              ? "bg-red-100 dark:bg-red-900/40 border-red-500"
                              : ""
                          }
                        `}
                        disabled={submitted}
                      >
                        <span className="truncate">{opt}</span>
                        {submitted && showCorrect && (
                          <CheckCircle className="text-green-500 w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                        {submitted && showIncorrect && (
                          <XCircle className="text-red-500 w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Score */}
          {submitted && score !== null && (
            <div className="text-center text-base sm:text-lg text-gray-700 dark:text-gray-200 font-medium mt-4">
              Your Score:{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {score}/{questions.length}
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
            {!submitted ? (
              <button
                className="px-5 sm:px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex-1 text-sm sm:text-base"
                onClick={handleSubmit}
              >
                Submit Quiz
              </button>
            ) : (
              <>
                <button
                  className="px-5 sm:px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition flex-1 text-sm sm:text-base"
                  onClick={handleRetry}
                >
                  <RotateCcw className="inline w-4 h-4 mr-1" />
                  Retry
                </button>
                <button
                  className="px-5 sm:px-6 py-3 bg-gray-500 text-white rounded hover:bg-gray-600 transition flex-1 text-sm sm:text-base"
                  onClick={() => router.back()}
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
