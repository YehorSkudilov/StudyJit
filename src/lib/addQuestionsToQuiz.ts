import db from "@/lib/db";

/**
 * Replaces all questions for a quiz by its ID.
 * Ensures only the quiz owner can update their own quiz.
 *
 * @param quizId - The quiz ID
 * @param questions - Array of questions [{ question, options, correct }]
 * @param userId - The ID of the logged-in user (for ownership validation)
 */
export async function addQuestionsToQuiz(
  quizId: number,
  questions: Array<{ question: string; options: string[]; correct: string }> = [],
  userId?: number | string
) {
  if (!quizId || questions.length === 0) {
    throw new Error("Invalid input: quizId and non-empty questions are required.");
  }

  if (!userId) {
    throw new Error("User ID is required to add questions.");
  }

  try {
    // 🛡️ Verify ownership
    const [checkRows]: any = await db.query(
      `SELECT user_id FROM quizzes WHERE id = ?`,
      [quizId]
    );

    if (!checkRows.length) {
      throw new Error("Quiz not found.");
    }

    if (checkRows[0].user_id !== Number(userId)) {
      throw new Error("Forbidden: You do not own this quiz.");
    }

    // 🧹 Clear existing questions
    await db.execute(`DELETE FROM quiz_questions WHERE quiz_id = ?`, [quizId]);

    // 📝 Insert new questions
    for (const q of questions) {
      const [a, b, c, d] = q.options || [];
      await db.execute(
        `INSERT INTO quiz_questions 
          (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [quizId, q.question, a, b, c, d, q.correct]
      );
    }

    console.log(`✅ Updated quiz #${quizId} (user ${userId}) with ${questions.length} questions.`);
    return { success: true, quizId, questionCount: questions.length };
  } catch (error: any) {
    console.error("❌ addQuestionsToQuiz error:", error);
    throw new Error(error.message || "Failed to add questions.");
  }
}
