using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;
using StudyJit.Api.Quizzes;

namespace StudyJit.Api.Controllers;

/// <summary>The web app also sends the quiz's name, prompt and question count; it saves them just before, so only the id is used.</summary>
public record GenerateQuizForm(int QuizId);

public record GenerateQuizResponse(bool Success, string Status, int QuizId, int QueueNumber);

[Route("api/ai")]
public class AiController(ApiDbContext db, ICurrentUser me, QuizGenerationQueue queue, OpenAiQuizClient openAi) : ApiControllerBase
{
    /// <summary>
    /// Queues the quiz for generation from its saved name, description, prompt, question count and linked files.
    /// Poll GET api/items/quizzes/get/{id} for generation_status and queue_number.
    /// </summary>
    [HttpPost("generateQuiz")]
    [Consumes("multipart/form-data", "application/x-www-form-urlencoded")]
    [EnableRateLimiting(RateLimits.Generate)]
    [ProducesResponseType<GenerateQuizResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GenerateQuiz([FromForm] GenerateQuizForm form, CancellationToken ct)
    {
        if (!openAi.IsConfigured)
            return Error(StatusCodes.Status503ServiceUnavailable, "Quiz generation isn't set up on this server.");
        var userId = me.Id;
        var quiz = await db.Quizzes.FirstOrDefaultAsync(q => q.Id == form.QuizId && q.UserId == userId, ct);
        if (quiz == null)
            return NotFoundError("Quiz not found.");

        if (quiz.GenerationStatus != GenerationStatus.Pending)
        {
            quiz.GenerationStatus = GenerationStatus.Queued;
            await db.SaveChangesAsync(ct);
        }
        var place = await queue.EnqueueAsync(quiz.Id, ct);
        return Ok(new GenerateQuizResponse(true, place == 0 ? GenerationStatus.Pending : GenerationStatus.Queued, quiz.Id, place));
    }
}
