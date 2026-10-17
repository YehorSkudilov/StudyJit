using System.Text.Json.Serialization;
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

public record ParseCoursesRequest(string? Text);

public record ParseCoursesResponse(List<ParsedCourse> Courses);

public record CreatedQuizzesResponse(List<QuizSummary> Created);

public record OrganizeResponse(List<FolderPlan> Folders);

public record CreateExamRequest(
    string? Name,
    [property: JsonPropertyName("set_ids")] int[] SetIds,
    string? Focus);

[Route("api/ai")]
public class AiController(ApiDbContext db, ICurrentUser me, QuizGenerationQueue queue, OpenAiQuizClient openAi, CourseAssistant assistant,
    TimeProvider clock) : ApiControllerBase
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

    /// <summary>Reads the courses out of text pasted from a school's learning system, for the user to confirm and create.</summary>
    [HttpPost("courses/parse")]
    [EnableRateLimiting(RateLimits.Generate)]
    [ProducesResponseType<ParseCoursesResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ParseCourses(ParseCoursesRequest request, CancellationToken ct)
    {
        if (!assistant.IsConfigured)
            return Error(StatusCodes.Status503ServiceUnavailable, "AI isn't set up on this server.");
        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequestError("Paste your course list first.");
        try
        {
            return Ok(new ParseCoursesResponse(await assistant.ParseCoursesAsync(request.Text, ct)));
        }
        catch (QuizGenerationException e)
        {
            return Error(StatusCodes.Status502BadGateway, e.Message);
        }
    }

    /// <summary>The AI's suggested folders for the course's files (e.g. one per week); apply it with POST api/courses/{id}/folders/apply.</summary>
    [HttpPost("courses/{id:int}/organize")]
    [EnableRateLimiting(RateLimits.Generate)]
    [ProducesResponseType<OrganizeResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Organize(int id, CancellationToken ct)
    {
        if (!assistant.IsConfigured)
            return Error(StatusCodes.Status503ServiceUnavailable, "AI isn't set up on this server.");
        var userId = me.Id;
        var course = await db.Courses.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (course == null)
            return NotFoundError("Course not found.");
        var files = await db.Files.Where(f => f.UserId == userId && f.CourseId == id).OrderBy(f => f.Name).ToListAsync(ct);
        if (files.Count == 0)
            return BadRequestError("Upload some files first.");
        var planFiles = new List<PlanFile>();
        foreach (var f in files)
            planFiles.Add(new PlanFile(f.Id, f.Name, f.Size, await ExcerptAsync(f, ct)));
        try
        {
            var title = string.Join(" ", new[] { course.Code, course.Name }.Where(s => s.Length > 0));
            return Ok(new OrganizeResponse(await assistant.OrganizeAsync(title, planFiles, ct)));
        }
        catch (QuizGenerationException e)
        {
            return Error(StatusCodes.Status502BadGateway, e.Message);
        }
    }

    /// <summary>
    /// Creates an exam from chosen study sets (e.g. the ones a midterm covers) and queues it: the AI writes it from
    /// those sets' files and study guides.
    /// </summary>
    [HttpPost("courses/{id:int}/exams")]
    [EnableRateLimiting(RateLimits.Generate)]
    [ProducesResponseType<CreatedQuizzesResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateExam(int id, CreateExamRequest request, CancellationToken ct)
    {
        if (!openAi.IsConfigured)
            return Error(StatusCodes.Status503ServiceUnavailable, "AI isn't set up on this server.");
        var name = request.Name?.Trim() ?? "";
        if (name.Length == 0)
            return BadRequestError("Give the exam a name.");
        var userId = me.Id;
        if (!await CoursesController.Owns(db, userId, id, ct))
            return NotFoundError("Course not found.");
        var sets = await db.Quizzes.Where(q => q.UserId == userId && q.CourseId == id && q.Kind == QuizKind.Set && request.SetIds.Contains(q.Id))
            .OrderBy(q => q.Id).ToListAsync(ct);
        if (sets.Count == 0)
            return BadRequestError("Pick at least one study set for the exam to cover.");

        var focus = request.Focus?.Trim() ?? "";
        var exam = new Quiz
        {
            UserId = userId,
            CourseId = id,
            Kind = QuizKind.Exam,
            SourceQuizIds = sets.Select(s => s.Id).ToList(),
            Name = name.Length > 255 ? name[..255] : name,
            Description = $"Covers {string.Join(", ", sets.Select(s => s.Name))}",
            Prompt = $"This is a cumulative exam ({name}) covering: {string.Join("; ", sets.Select(s => s.Name))}. "
                + "Cover every one of those topics in proportion to how much material it has, mix recall with application, "
                + "and make it exam-style."
                + (focus.Length > 0 ? $" {focus}" : ""),
            GenerationStatus = GenerationStatus.Queued,
            CreatedAt = clock.GetUtcNow(),
        };
        return Ok(new CreatedQuizzesResponse(await QueueAsync([exam], ct)));
    }

    async Task<List<QuizSummary>> QueueAsync(List<Quiz> quizzes, CancellationToken ct)
    {
        db.Quizzes.AddRange(quizzes);
        await db.SaveChangesAsync(ct);
        foreach (var quiz in quizzes)
            await queue.EnqueueAsync(quiz.Id, ct);
        return quizzes.Select(QuizzesController.Summary).ToList();
    }

    static readonly string[] TextExtensions = [".txt", ".md", ".csv", ".html", ".htm"];

    /// <summary>The start of a plain-text file, to help the planner tell what it covers.</summary>
    static async Task<string?> ExcerptAsync(StoredFile file, CancellationToken ct)
    {
        if (!TextExtensions.Contains(Path.GetExtension(file.Name).ToLowerInvariant()) || !System.IO.File.Exists(file.Path))
            return null;
        using var reader = new StreamReader(file.Path);
        var buffer = new char[400];
        var read = await reader.ReadBlockAsync(buffer.AsMemory(), ct);
        return new string(buffer, 0, read);
    }
}
