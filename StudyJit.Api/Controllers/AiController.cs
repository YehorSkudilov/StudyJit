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

public record AutopilotRequest(int? Sets);

public record AutopilotResponse(List<QuizSummary> Created);

[Route("api/ai")]
public class AiController(ApiDbContext db, ICurrentUser me, QuizGenerationQueue queue, OpenAiQuizClient openAi, CourseAssistant assistant,
    TimeProvider clock) : ApiControllerBase
{
    const int MaxAutopilotSets = 12;

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

    /// <summary>
    /// Course autopilot: the AI plans the course's study sets from its files (or, with none, from what the course
    /// covers), and each is created, linked to its files and queued for generation.
    /// </summary>
    [HttpPost("courses/{id:int}/autopilot")]
    [EnableRateLimiting(RateLimits.Generate)]
    [ProducesResponseType<AutopilotResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Autopilot(int id, AutopilotRequest request, CancellationToken ct)
    {
        if (!assistant.IsConfigured)
            return Error(StatusCodes.Status503ServiceUnavailable, "AI isn't set up on this server.");
        var userId = me.Id;
        var course = await db.Courses.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (course == null)
            return NotFoundError("Course not found.");

        var files = await db.Files.Where(f => f.UserId == userId && f.CourseId == id).OrderBy(f => f.Name).ToListAsync(ct);
        var planFiles = new List<PlanFile>();
        foreach (var f in files)
            planFiles.Add(new PlanFile(f.Id, f.Name, f.Size, await ExcerptAsync(f, ct)));

        List<PlannedSet> plan;
        try
        {
            var title = string.Join(" ", new[] { course.Code, course.Name, course.Term.Length > 0 ? $"({course.Term})" : "" }.Where(s => s.Length > 0));
            plan = await assistant.PlanAsync(title, planFiles, Math.Clamp(request.Sets ?? 6, 1, MaxAutopilotSets), ct);
        }
        catch (QuizGenerationException e)
        {
            return Error(StatusCodes.Status502BadGateway, e.Message);
        }
        if (plan.Count == 0)
            return Error(StatusCodes.Status502BadGateway, "The AI couldn't plan any study sets. Try adding files first.");

        var now = clock.GetUtcNow();
        var quizzes = plan.Select(p => new Quiz
        {
            UserId = userId,
            CourseId = id,
            Name = p.Name.Length > 255 ? p.Name[..255] : p.Name,
            Description = p.Description,
            Prompt = p.Focus,
            NumQuestions = p.Questions,
            GenerationStatus = GenerationStatus.Queued,
            CreatedAt = now,
        }).ToList();
        db.Quizzes.AddRange(quizzes);
        await db.SaveChangesAsync(ct);
        for (var i = 0; i < plan.Count; i++)
            db.QuizFiles.AddRange(plan[i].FileIds.Select(fileId => new QuizFile { QuizId = quizzes[i].Id, FileId = fileId, LinkedAt = now }));
        await db.SaveChangesAsync(ct);
        foreach (var quiz in quizzes)
            await queue.EnqueueAsync(quiz.Id, ct);

        return Ok(new AutopilotResponse(quizzes.Select(QuizzesController.Summary).ToList()));
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
