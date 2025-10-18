export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 px-6">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-2xl text-center">
        <h2 className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-4">
          About StudyBuddy
        </h2>
        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
          StudyBuddy helps you learn smarter by converting your notes into AI-powered
          interactive quizzes. Whether you're reviewing for exams or learning new topics,
          StudyBuddy makes studying more engaging and efficient.
        </p>
      </div>
    </div>
  );
}
