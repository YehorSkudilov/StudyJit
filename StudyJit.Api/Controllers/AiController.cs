using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;
using StudyJit.Api.Files;
using StudyJit.Api.Quizzes;

namespace StudyJit.Api.Controllers;

/// <summary>The web app also sends the quiz's name, prompt and question count; it saves them just before, so only the id is used.</summary>
public record GenerateQuizForm(int QuizId);

public record GenerateQuizResponse(bool Success, string Status, int QuizId, int QueueNumber);

public record ParseCoursesRequest(string? Text);

public record ParseCoursesResponse(List<ParsedCourse> Courses);

public record CreatedQuizzesResponse(List<QuizSummary> Created);

public record RegenerateRequest([property: JsonPropertyName("quiz_ids")] int[] QuizIds);

public record RegenerateResponse(int Queued);

public record OrganizeResponse(List<FolderPlan> Folders);

public record GradeWrittenRequest([property: JsonPropertyName("written_answer_id")] int WrittenAnswerId, string? Answer);

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

    /// <summary>
    /// Queues several study sets or exams to be generated again (e.g. the ones ticked on a course's Study sets tab).
    /// Counts as one request against the generation limit; ones already generating are left alone.
    /// </summary>
    /// <summary>Marks the student's answer to one of their written-answer questions against its key points.</summary>
    [HttpPost("gradeWritten")]
    [EnableRateLimiting(RateLimits.Grade)]
    [ProducesResponseType<WrittenGrade>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GradeWritten(GradeWrittenRequest request, CancellationToken ct)
    {
        if (!openAi.IsConfigured)
            return Error(StatusCodes.Status503ServiceUnavailable, "AI marking isn't set up on this server.");
        var userId = me.Id;
        var item = await db.QuizWrittenAnswers.AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == request.WrittenAnswerId && db.Quizzes.Any(q => q.Id == w.QuizId && q.UserId == userId), ct);
        if (item == null)
            return NotFoundError("Question not found.");
        var answer = request.Answer?.Trim() ?? "";
        if (answer.Length == 0)
            return Ok(new WrittenGrade(0, "incorrect", "There's no answer to mark yet.", [], item.KeyPoints));
        if (answer.Length > MaxWrittenAnswerChars)
            return BadRequestError($"Answers can be up to {MaxWrittenAnswerChars} characters.");
        try
        {
            return Ok(await openAi.GradeAsync(item.Question, item.Kind, item.ModelAnswer, item.KeyPoints, answer, ct));
        }
        catch (QuizGenerationException e)
        {
            return Error(StatusCodes.Status502BadGateway, e.Message);
        }
    }

    const int MaxWrittenAnswerChars = 8000;

    [HttpPost("regenerate")]
    [EnableRateLimiting(RateLimits.Generate)]
    [ProducesResponseType<RegenerateResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Regenerate(RegenerateRequest request, CancellationToken ct)
    {
        if (!openAi.IsConfigured)
            return Error(StatusCodes.Status503ServiceUnavailable, "Quiz generation isn't set up on this server.");
        if (request.QuizIds is not { Length: > 0 })
            return BadRequestError("Pick at least one study set.");
        var userId = me.Id;
        var quizzes = await db.Quizzes.Where(q => q.UserId == userId && request.QuizIds.Contains(q.Id) && q.GenerationStatus != GenerationStatus.Pending)
            .OrderBy(q => q.Id).ToListAsync(ct);
        foreach (var quiz in quizzes)
            quiz.GenerationStatus = GenerationStatus.Queued;
        await db.SaveChangesAsync(ct);
        foreach (var quiz in quizzes)
            await queue.EnqueueAsync(quiz.Id, ct);
        return Ok(new RegenerateResponse(quizzes.Count));
    }

    /// <summary>Reads the courses out of text pasted from a school's learning system, for the user to confirm and create.</summary>
    [HttpPost("courses/parse")]
    [EnableRateLimiting(RateLimits.Assist)]
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
    [EnableRateLimiting(RateLimits.Assist)]
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
        // What's inside each file (its title and opening words) says more than a name like "Lecture_03_final.pdf".
        var planFiles = new List<PlanFile>();
        foreach (var f in files)
            planFiles.Add(new PlanFile(f.Id, f.Name, f.Size, await FilePeek.PeekAsync(f.Path, f.Name, ct)));
        var existing = await db.Folders.Where(f => f.UserId == userId && f.CourseId == id).Select(f => f.Name).ToListAsync(ct);
        try
        {
            var title = string.Join(" ", new[] { course.Code, course.Name }.Where(s => s.Length > 0));
            return Ok(new OrganizeResponse(await assistant.OrganizeAsync(title, planFiles, existing, ct)));
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
}
