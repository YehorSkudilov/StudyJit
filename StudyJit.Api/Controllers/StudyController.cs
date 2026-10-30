using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;

namespace StudyJit.Api.Controllers;

public record StudyAnswerDto(
    Guid Id,
    [property: JsonPropertyName("quiz_id")] int QuizId,
    string Key,
    bool Correct,
    [property: JsonPropertyName("answered_at")] DateTimeOffset AnsweredAt);

public record StudyBestDto(string Key, double Value, [property: JsonPropertyName("lower_is_better")] bool LowerIsBetter);

/// <summary>Answers and bests to add; either list may be empty.</summary>
public record SaveProgressRequest(List<StudyAnswerDto>? Answers, List<StudyBestDto>? Bests);

/// <summary>How a question has gone over every answer: when it last came up, and how often it was right and wrong.</summary>
public record QuestionHistoryDto(
    [property: JsonPropertyName("quiz_id")] int QuizId,
    string Key,
    DateTimeOffset Seen,
    int Right,
    int Wrong);

public record ProgressResponse(List<QuestionHistoryDto> History, List<StudyBestDto> Bests);

/// <summary>
/// Practice history and personal bests, kept with the account so they follow the user between the app (which sends
/// what it saved offline once it's back online) and the website. The study modes use the history to put new and missed
/// questions first.
/// </summary>
[Route("api/study/progress")]
public class StudyController(ApiDbContext db, ICurrentUser me, TimeProvider clock) : ApiControllerBase
{
    /// <summary>Most answers and bests in one request (the app sends what built up offline in batches of this).</summary>
    public const int MaxBatch = 1000;

    /// <summary>The history of every question answered (or with quiz={id}, one set's), and every best.</summary>
    [HttpGet]
    [ProducesResponseType<ProgressResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(int? quiz, CancellationToken ct)
    {
        var userId = me.Id;
        var answers = db.StudyAnswers.Where(a => a.UserId == userId);
        if (quiz != null)
            answers = answers.Where(a => a.QuizId == quiz);
        var history = await answers.GroupBy(a => new { a.QuizId, a.Key })
            .Select(g => new QuestionHistoryDto(g.Key.QuizId, g.Key.Key, g.Max(a => a.AnsweredAt), g.Count(a => a.Correct), g.Count(a => !a.Correct)))
            .ToListAsync(ct);
        var bests = await db.StudyBests.Where(b => b.UserId == userId)
            .Select(b => new StudyBestDto(b.Key, b.Value, b.LowerIsBetter)).ToListAsync(ct);
        return Ok(new ProgressResponse(history, bests));
    }

    /// <summary>
    /// Adds answers (ones already here, by id, are skipped; ones for sets that are gone are dropped) and bests (kept
    /// only where they beat the one here).
    /// </summary>
    [HttpPost]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Save(SaveProgressRequest request, CancellationToken ct)
    {
        var answers = request.Answers ?? [];
        var bests = request.Bests ?? [];
        if (answers.Count + bests.Count > MaxBatch)
            return BadRequestError($"Send up to {MaxBatch} answers and bests at a time.");
        if (answers.Any(a => string.IsNullOrWhiteSpace(a.Key) || a.Key.Length > 20) || bests.Any(b => string.IsNullOrWhiteSpace(b.Key) || b.Key.Length > 40))
            return BadRequestError("Every answer and best needs a key.");
        var userId = me.Id;

        if (answers.Count > 0)
        {
            var ids = answers.Select(a => a.Id).ToList();
            var quizIds = answers.Select(a => a.QuizId).Distinct().ToList();
            var known = await db.StudyAnswers.Where(a => ids.Contains(a.Id)).Select(a => a.Id).ToListAsync(ct);
            var owned = await db.Quizzes.Where(q => q.UserId == userId && quizIds.Contains(q.Id)).Select(q => q.Id).ToListAsync(ct);
            var now = clock.GetUtcNow();
            foreach (var a in answers.Where(a => !known.Contains(a.Id) && owned.Contains(a.QuizId)).DistinctBy(a => a.Id))
                db.StudyAnswers.Add(new StudyAnswer
                {
                    Id = a.Id, UserId = userId, QuizId = a.QuizId, Key = a.Key.Trim(), Correct = a.Correct,
                    // A device's clock can be off; an answer can't be from the future.
                    AnsweredAt = a.AnsweredAt > now ? now : a.AnsweredAt,
                });
        }

        if (bests.Count > 0)
        {
            var keys = bests.Select(b => b.Key).ToList();
            var existing = await db.StudyBests.Where(b => b.UserId == userId && keys.Contains(b.Key)).ToDictionaryAsync(b => b.Key, ct);
            foreach (var best in bests)
            {
                if (!existing.TryGetValue(best.Key, out var row))
                {
                    row = new StudyBest { UserId = userId, Key = best.Key, Value = best.Value, LowerIsBetter = best.LowerIsBetter, UpdatedAt = clock.GetUtcNow() };
                    db.StudyBests.Add(row);
                    existing[best.Key] = row;
                }
                else if (best.LowerIsBetter ? best.Value < row.Value : best.Value > row.Value)
                {
                    row.Value = best.Value;
                    row.UpdatedAt = clock.GetUtcNow();
                }
            }
        }

        await db.SaveChangesAsync(ct);
        return Ok(Success());
    }
}
