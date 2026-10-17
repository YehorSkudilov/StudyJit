"use client";

import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useStudyQuiz } from "@/lib/study";
import { modeInfo } from "@/lib/modes";
import Flashcards from "@/components/study/Flashcards";
import Guide from "@/components/study/Guide";
import Learn from "@/components/study/Learn";
import Match from "@/components/study/Match";
import Practice from "@/components/study/Practice";
import Test from "@/components/study/Test";
import TrueFalse from "@/components/study/TrueFalse";
import Write from "@/components/study/Write";

const components = {
  learn: Learn,
  flashcards: Flashcards,
  practice: Practice,
  test: Test,
  match: Match,
  truefalse: TrueFalse,
  write: Write,
  guide: Guide,
};

/** /study/{quizId}/{mode}: one study session, full screen. */
export default function StudyPage() {
  const params = useParams<{ quizId: string; mode: string }>();
  const router = useRouter();
  const quizId = Number(params.quizId);
  const { quiz, error } = useStudyQuiz(quizId);
  const info = modeInfo(params.mode);

  const exit = () => {
    sessionStorage.setItem("selectedQuizId", String(quizId));
    router.push(quiz ? `/quizDetails/${encodeURIComponent(quiz.name)}` : "/learningSpace");
  };

  if (error || !info) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xl font-bold">{error ?? "That study mode doesn't exist."}</p>
        <button className="btn-primary" onClick={() => router.push("/learningSpace")}>
          Back to my study sets
        </button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
        Loading {info.title.toLowerCase()}…
      </div>
    );
  }

  const blocked = info.unavailable(quiz);
  if (blocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xl font-bold">{info.title} isn&apos;t available for this set</p>
        <p className="text-muted">{blocked}.</p>
        <button className="btn-primary" onClick={exit}>
          Back to the set
        </button>
      </div>
    );
  }

  const Mode = components[info.mode];
  return <Mode quiz={quiz} onExit={exit} />;
}
