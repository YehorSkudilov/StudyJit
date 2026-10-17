using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;
using StudyJit.Api.Quizzes;

namespace StudyJit.Api.Controllers;

/// <summary>Everything a course's study sets hold, together, for studying the whole course at once.</summary>
public record CourseStudyMaterial(
    int Id,
    string Name,
    [property: JsonPropertyName("set_count")] int SetCount,
    List<QuestionDto> Questions,
    List<TermDto> Terms);

public record CheatSheetRow(
    int Id,
    string Title,
    string Focus,
    string Content,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt);

public record CreateCheatSheetRequest(string? Focus, bool Detailed);

/// <summary>A course's material as a whole: course-wide study (flashcards, exams) and cheat sheets.</summary>
[Route("api/courses/{id:int}")]
public class CourseStudyController(ApiDbContext db, ICurrentUser me, CourseAssistant assistant, TimeProvider clock) : ApiControllerBase
{
    public const int MaxCheatSheets = 30;

    /// <summary>The questions and key terms of all the course's generated study sets.</summary>
    [HttpGet("study")]
    [ProducesResponseType<CourseStudyMaterial>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Study(int id, CancellationToken ct)
    {
        var course = await FindCourse(id, ct);
        if (course == null)
            return NotFoundError("Course not found.");
        var quizzes = await ReadyQuizzes(id, ct);
        return Ok(new CourseStudyMaterial(
            course.Id,
            course.Code.Length > 0 ? $"{course.Code} · {course.Name}" : course.Name,
            quizzes.Count,
            quizzes.SelectMany(QuizzesController.Questions).ToList(),
            quizzes.SelectMany(q => q.Terms.OrderBy(t => t.Id)).DistinctBy(t => t.Term.ToLowerInvariant())
                .Select(t => new TermDto(t.Term, t.Definition)).ToList()));
    }

    [HttpGet("cheatsheets")]
    [ProducesResponseType<List<CheatSheetRow>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> CheatSheets(int id, CancellationToken ct)
    {
        if (await FindCourse(id, ct) == null)
            return NotFoundError("Course not found.");
        var userId = me.Id;
        return Ok(await db.CheatSheets.Where(s => s.CourseId == id && s.UserId == userId).OrderByDescending(s => s.CreatedAt)
            .Select(s => new CheatSheetRow(s.Id, s.Title, s.Focus, s.Content, s.CreatedAt)).ToListAsync(ct));
    }

    /// <summary>Has the AI write a cheat sheet from the course's study sets (or, with none, from the course name).</summary>
    [HttpPost("cheatsheets")]
    [EnableRateLimiting(RateLimits.Generate)]
    [ProducesResponseType<CheatSheetRow>(StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateCheatSheet(int id, CreateCheatSheetRequest request, CancellationToken ct)
    {
        if (!assistant.IsConfigured)
            return Error(StatusCodes.Status503ServiceUnavailable, "AI isn't set up on this server.");
        var course = await FindCourse(id, ct);
        if (course == null)
            return NotFoundError("Course not found.");
        var userId = me.Id;
        if (await db.CheatSheets.CountAsync(s => s.CourseId == id && s.UserId == userId, ct) >= MaxCheatSheets)
            return BadRequestError($"A course can have up to {MaxCheatSheets} cheat sheets. Delete one first.");

        var focus = request.Focus?.Trim() ?? "";
        if (focus.Length > 1000)
            focus = focus[..1000];
        string title, content;
        try
        {
            var name = string.Join(" ", new[] { course.Code, course.Name }.Where(s => s.Length > 0));
            (title, content) = await assistant.CheatSheetAsync(name, Material(await ReadyQuizzes(id, ct)), focus, request.Detailed, ct);
        }
        catch (QuizGenerationException e)
        {
            return Error(StatusCodes.Status502BadGateway, e.Message);
        }

        var sheet = new CheatSheet { UserId = userId, CourseId = id, Title = title, Focus = focus, Content = content, CreatedAt = clock.GetUtcNow() };
        db.CheatSheets.Add(sheet);
        await db.SaveChangesAsync(ct);
        return Ok(new CheatSheetRow(sheet.Id, sheet.Title, sheet.Focus, sheet.Content, sheet.CreatedAt));
    }

    [HttpDelete("cheatsheets/{sheetId:int}")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteCheatSheet(int id, int sheetId, CancellationToken ct)
    {
        var userId = me.Id;
        var deleted = await db.CheatSheets.Where(s => s.Id == sheetId && s.CourseId == id && s.UserId == userId).ExecuteDeleteAsync(ct);
        return deleted == 0 ? NotFoundError("Cheat sheet not found.") : Ok(Success());
    }

    Task<Course?> FindCourse(int id, CancellationToken ct)
    {
        var userId = me.Id;
        return db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
    }

    Task<List<Quiz>> ReadyQuizzes(int courseId, CancellationToken ct)
    {
        var userId = me.Id;
        return db.Quizzes.AsNoTracking().Include(q => q.Questions).Include(q => q.Terms).AsSplitQuery()
            .Where(q => q.UserId == userId && q.CourseId == courseId && q.GenerationStatus == GenerationStatus.Success)
            .OrderBy(q => q.Id).ToListAsync(ct);
    }

    /// <summary>The study sets' guides, terms and questions as text for the AI to condense.</summary>
    static string Material(List<Quiz> quizzes)
    {
        var text = new StringBuilder();
        foreach (var q in quizzes)
        {
            text.AppendLine($"# {q.Name}");
            if (!string.IsNullOrWhiteSpace(q.Summary))
                text.AppendLine(q.Summary);
            foreach (var t in q.Terms)
                text.AppendLine($"- {t.Term}: {t.Definition}");
            foreach (var question in q.Questions)
                text.AppendLine($"Q: {question.Question} A: {question.CorrectAnswer}. {question.Explanation}");
            text.AppendLine();
        }
        return text.ToString();
    }
}
