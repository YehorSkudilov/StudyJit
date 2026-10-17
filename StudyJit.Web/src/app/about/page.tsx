export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6">
      <div className="card p-8 max-w-2xl text-center">
        <h2 className="text-4xl font-bold text-gradient mb-4">
          About StudyJit
        </h2>
        <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
          StudyJit helps you learn smarter by converting your notes into AI-powered
          interactive quizzes. Whether you&apos;re reviewing for exams or learning new topics,
          StudyJit makes studying more engaging and efficient.
        </p>
      </div>
    </div>
  );
}
