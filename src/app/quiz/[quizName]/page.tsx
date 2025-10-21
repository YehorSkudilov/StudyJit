"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  BookOpen,
  RotateCcw,
  ArrowUp,
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
  correct: string;
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
  const [showConfirmIncomplete, setShowConfirmIncomplete] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ✅ Scroll button toggle
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 250);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

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
        const res = await fetch(`/api/items/quizzes/get/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load quiz");

        const rawQuestions = (data.questions as Question[]) || [];
        const shuffledQuestions: Question[] = shuffleArray(
          rawQuestions.map((q) => ({
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

  // ✅ Correct score calculation
// ✅ Correct score calculation + update in DB
const submitQuiz = async () => {
  let total = 0;
  questions.forEach((q) => {
    const correctIndex = getCorrectAnswerIndex(q);
    const selected = answers[q.id];
    if (
      selected &&
      q.options[correctIndex]?.trim().toLowerCase() ===
        selected.trim().toLowerCase()
    ) {
      total++;
    }
  });

  const calculatedScore = total;
  setScore(calculatedScore);
  setSubmitted(true);
  setShowConfirmIncomplete(false);

  // ✅ Send updated score to the backend
  try {
    if (quizId) {
      const res = await fetch("/api/items/quizzes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quizId,
          lastScore: (calculatedScore / questions.length) * 100, // store as percentage
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update score");
      console.log("✅ Score updated:", data);
    }
  } catch (err) {
    console.error("❌ Failed to update quiz score:", err);
  }
};

  const handleSubmit = () => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      setShowConfirmIncomplete(true);
      return;
    }
    submitQuiz();
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
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
      {/* Confirm incomplete submission */}
      {showConfirmIncomplete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[90%] sm:w-[400px] shadow-xl text-center">
            <p className="text-gray-800 dark:text-gray-100 text-lg mb-4">
              ⚠️ You haven’t answered all questions.
              <br />
              Submit anyway? Unanswered will count as incorrect.
            </p>
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setShowConfirmIncomplete(false)}
                className="px-4 py-2 rounded bg-gray-400 hover:bg-gray-500 text-white"
              >
                Cancel
              </button>
              <button
                onClick={submitQuiz}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col px-3 sm:px-8 md:px-20 py-6 sm:py-10 gap-6">
        <div className="relative p-4 sm:p-8 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col gap-6 max-w-4xl w-full mx-auto">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="absolute top-6 left-3 sm:top-7 sm:left-4 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors"
            title="Go Back"
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
            {questions.map((q, idx) => {
              const userSelected = answers[q.id];
              return (
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
                      const isSelected = userSelected === opt;
                      const isCorrect =
                        opt.trim().toLowerCase() === q.correct.trim().toLowerCase();
                      const unanswered = submitted && !userSelected;
                      const showCorrect =
                        submitted &&
                        ((isCorrect && isSelected) || (!isSelected && isCorrect));
                      const showIncorrect =
                        submitted &&
                        ((isSelected && !isCorrect) ||
                          (unanswered && !isCorrect));

                      return (
                        <button
                          key={opt}
                          onClick={() => selectAnswer(q.id, opt)}
                          className={`flex items-start justify-between w-full px-3 sm:px-4 py-2 sm:py-3 text-left rounded-lg border transition text-sm sm:text-base
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
                                ? "bg-red-100 dark:bg-red-900/30 border-red-400 opacity-75"
                                : ""
                            }
                          `}
                          disabled={submitted}
                        >
                          {/* ✅ Full wrapping, no truncation */}
                          <span className="whitespace-normal break-words text-left flex-1 leading-snug overflow-visible">
                            {opt}
                          </span>

                          {submitted && showCorrect && (
                            <CheckCircle className="text-green-500 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-1" />
                          )}
                          {submitted && showIncorrect && (
                            <XCircle className="text-red-500 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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

      {/* Floating "Scroll to Top" button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
          title="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </>
  );
}