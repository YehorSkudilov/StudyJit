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

interface Question {
  id: number;
  question: string;
  options: string[];
  correct: string; // now holds the TEXT of the correct answer
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

        setQuestions(data.questions || []);
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

  // ✅ FIXED: now detects index by matching the correct TEXT
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

      console.log(`Comparing question ${q.id}:`);
      console.log(`Selected answer index: "${selectedIndex}"`);
      console.log(`Correct answer index: "${correctIndex}"`);

      if (selectedIndex === correctIndex) total++;
    });

    setScore(total);
    setSubmitted(true);
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
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

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col px-6 sm:px-20 py-10 gap-8">
        <div className="relative p-8 bg-white dark:bg-gray-800 rounded-xl shadow flex flex-col gap-6 max-w-4xl w-full mx-auto">
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white rounded-full transition-colors cursor-pointer z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <header className="w-full flex flex-col items-center justify-center relative mb-4">
            <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2 leading-tight">
              <BookOpen className="w-6 h-6" />
              {decodedQuizName}
            </h1>
            {description && (
              <p className="mt-2 text-gray-600 dark:text-gray-300 text-center">
                {description}
              </p>
            )}
          </header>

          <div className="flex flex-col gap-6">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className={`p-5 rounded-lg border transition-colors ${
                  submitted
                    ? "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                }`}
              >
                <h3 className="text-lg font-semibold mb-3">
                  {idx + 1}. {q.question}
                </h3>

                <div className="grid sm:grid-cols-2 gap-3">
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
                        className={`flex items-center justify-between w-full px-4 py-3 text-left rounded-lg border transition
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
                        <span>{opt}</span>
                        {submitted && showCorrect && (
                          <CheckCircle className="text-green-500 w-5 h-5" />
                        )}
                        {submitted && showIncorrect && (
                          <XCircle className="text-red-500 w-5 h-5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {submitted && score !== null && (
            <div className="text-center text-lg text-gray-700 dark:text-gray-200 font-medium mt-6">
              Your Score:{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {score}/{questions.length}
              </span>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            {!submitted ? (
              <button
                className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex-1"
                onClick={handleSubmit}
              >
                Submit Quiz
              </button>
            ) : (
              <>
                <button
                  className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 transition flex-1"
                  onClick={handleRetry}
                >
                  <RotateCcw className="inline w-4 h-4 mr-1" />
                  Retry
                </button>
                <button
                  className="px-6 py-3 bg-gray-500 text-white rounded hover:bg-gray-600 transition flex-1"
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
