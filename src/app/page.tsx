import { UploadCloud, FileText, Brain } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
      {/* Hero Section */}
      <main className="flex flex-col items-center text-center px-6 sm:px-20 py-12 gap-6">
        {/* ✅ Simple centered logo */}
        <Image
          src="/images/logo.png"
          alt="StudyBuddy Logo"
          width={120}
          height={120}
          className="mb-2"
          priority
        />

        <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight">
          Learn Smarter with AI
        </h2>
        <p className="text-lg sm:text-xl max-w-2xl">
          Upload your lecture notes and StudyBuddy will generate interactive
          quizzes so you can test your knowledge and retain information faster.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 text-white rounded-full text-lg font-semibold hover:bg-blue-700 transition"
          >
            Get Started
          </Link>
          <Link
            href="#features"
            className="px-6 py-3 border border-blue-600 text-blue-600 rounded-full text-lg font-semibold hover:bg-blue-50 dark:hover:bg-gray-700 transition"
          >
            Learn More
          </Link>
        </div>
      </main>

      {/* Features Section */}
      <section
        id="features"
        className="w-full py-16 bg-gray-100 dark:bg-gray-900 px-6 sm:px-20"
      >
        <h3 className="text-3xl sm:text-4xl font-bold text-center mb-10">
          Features
        </h3>

        <div className="grid gap-8 sm:grid-cols-3 max-w-6xl mx-auto">
          {/* Feature 1 */}
          <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg transition">
            <UploadCloud className="w-14 h-14 text-blue-600 dark:text-blue-400" />
            <h4 className="mt-4 font-semibold text-xl">Upload Lecture Notes</h4>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Easily upload PDFs, slides, or text files to start creating quizzes.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg transition">
            <FileText className="w-14 h-14 text-blue-600 dark:text-blue-400" />
            <h4 className="mt-4 font-semibold text-xl">AI-Generated Quizzes</h4>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              The AI creates multiple-choice, true/false, and short-answer
              questions automatically.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-lg transition">
            <Brain className="w-14 h-14 text-blue-600 dark:text-blue-400" />
            <h4 className="mt-4 font-semibold text-xl">Powered by GPT-4o</h4>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Leverages GPT-4o intelligence to understand your notes deeply
              and craft meaningful, high-quality quizzes in seconds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
