import { getConnection } from "@/lib/db";

/**
 * Replaces all questions for a quiz by its ID.
 * Deletes all old questions first, then inserts the new ones.
 *
 * @param quizId - The ID of the quiz (required)
 * @param questions - Array of questions [{ question, options, correct }]
 */
export async function addQuestionsToQuiz(
  quizId: number,
  questions: Array<{ question: string; options: string[]; correct: string }> = []
) {
  if (!quizId || questions.length === 0) {
    throw new Error("Invalid input: quizId and non-empty questions are required.");
  }

  const db = await getConnection();

  try {
    // ✅ Clear existing questions
    await db.execute(`DELETE FROM quiz_questions WHERE quiz_id = ?`, [quizId]);

    // ✅ Insert new questions
    for (const q of questions) {
      const [a, b, c, d] = q.options || [];
      await db.execute(
        `INSERT INTO quiz_questions 
          (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [quizId, q.question, a, b, c, d, q.correct]
      );
    }

    console.log(`✅ Updated quiz #${quizId} with ${questions.length} questions.`);
    return { success: true, quizId, questionCount: questions.length };
  } finally {
    await db.end();
  }
}
