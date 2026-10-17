using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;
using StudyJit.Api.Files;

namespace StudyJit.Api.Controllers;

public record CourseRow(
    int Id,
    string Code,
    string Name,
    string Term,
    string Color,
    [property: JsonPropertyName("quiz_count")] int QuizCount,
    [property: JsonPropertyName("ready_count")] int ReadyCount,
    [property: JsonPropertyName("generating_count")] int GeneratingCount,
    [property: JsonPropertyName("file_count")] int FileCount,
    [property: JsonPropertyName("average_score")] decimal? AverageScore,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt);

public record CourseRequest(string? Code, string? Name, string? Term, string? Color);

public record BulkCoursesRequest(List<CourseRequest> Courses);

public record AttachFilesRequest([property: JsonPropertyName("file_ids")] int[] FileIds);

/// <summary>Courses: what the user's study sets and files are organised by.</summary>
[Route("api/courses")]
public class CoursesController(ApiDbContext db, ICurrentUser me, FileStorage storage, TimeProvider clock) : ApiControllerBase
{
    public const int MaxCourses = 100;

    /// <summary>The colours the web app knows; new courses take the next one round.</summary>
    public static readonly string[] Colors = ["blue", "violet", "emerald", "amber", "rose", "cyan", "indigo", "orange"];

    [HttpGet]
    [ProducesResponseType<List<CourseRow>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await Rows(db.Courses.Where(c => c.UserId == me.Id), ct));

    [HttpGet("{id:int}")]
    [ProducesResponseType<CourseRow>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var rows = await Rows(db.Courses.Where(c => c.UserId == me.Id && c.Id == id), ct);
        return rows.Count == 0 ? NotFoundError("Course not found.") : Ok(rows[0]);
    }

    [HttpPost]
    [ProducesResponseType<CourseRow>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Create(CourseRequest request, CancellationToken ct)
    {
        var (ids, error) = await AddAsync([request], ct);
        return ids != null ? await Get(ids[0], ct) : BadRequestError(error!);
    }

    /// <summary>Creates several courses at once, e.g. the ones the AI read from a pasted course list.</summary>
    [HttpPost("bulk")]
    [ProducesResponseType<List<CourseRow>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateMany(BulkCoursesRequest request, CancellationToken ct)
    {
        if (request.Courses is not { Count: > 0 })
            return BadRequestError("No courses to create.");
        var (ids, error) = await AddAsync(request.Courses, ct);
        return ids != null ? Ok(await Rows(db.Courses.Where(c => c.UserId == me.Id && ids.Contains(c.Id)), ct)) : BadRequestError(error!);
    }

    [HttpPatch("{id:int}")]
    [ProducesResponseType<CourseRow>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(int id, CourseRequest request, CancellationToken ct)
    {
        var course = await db.Courses.FirstOrDefaultAsync(c => c.Id == id && c.UserId == me.Id, ct);
        if (course == null)
            return NotFoundError("Course not found.");
        if (request.Name != null)
        {
            if (request.Name.Trim().Length == 0)
                return BadRequestError("Course name is required.");
            course.Name = Clip(request.Name, 255);
        }
        if (request.Code != null)
            course.Code = Clip(request.Code, 50);
        if (request.Term != null)
            course.Term = Clip(request.Term, 50);
        if (request.Color != null && Colors.Contains(request.Color))
            course.Color = request.Color;
        await db.SaveChangesAsync(ct);
        return await Get(id, ct);
    }

    /// <summary>Deletes the course with its study sets and its files.</summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var userId = me.Id;
        var course = await db.Courses.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (course == null)
            return NotFoundError("Course not found.");
        var files = await db.Files.Where(f => f.UserId == userId && f.CourseId == id).ToListAsync(ct);
        await db.Quizzes.Where(q => q.UserId == userId && q.CourseId == id).ExecuteDeleteAsync(ct);
        db.Files.RemoveRange(files);
        db.Courses.Remove(course);
        await db.SaveChangesAsync(ct);
        foreach (var file in files)
            storage.Delete(file.Path);
        return Ok(Success());
    }

    /// <summary>Moves files the user already has into the course.</summary>
    [HttpPost("{id:int}/files")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> AttachFiles(int id, AttachFilesRequest request, CancellationToken ct)
    {
        var userId = me.Id;
        if (!await Owns(db, userId, id, ct))
            return NotFoundError("Course not found.");
        await db.Files.Where(f => f.UserId == userId && request.FileIds.Contains(f.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.CourseId, id), ct);
        return Ok(Success());
    }

    public static Task<bool> Owns(ApiDbContext db, string userId, int courseId, CancellationToken ct = default) =>
        db.Courses.AnyAsync(c => c.Id == courseId && c.UserId == userId, ct);

    /// <summary>Adds the courses, giving each the next colour; or says why it can't.</summary>
    async Task<(List<int>? Ids, string? Error)> AddAsync(List<CourseRequest> requests, CancellationToken ct)
    {
        var userId = me.Id;
        var existing = await db.Courses.CountAsync(c => c.UserId == userId, ct);
        if (existing + requests.Count > MaxCourses)
            return (null, $"You can have up to {MaxCourses} courses.");
        if (requests.Any(r => string.IsNullOrWhiteSpace(r.Name)))
            return (null, "Course name is required.");
        var courses = requests.Select((r, i) => new Course
        {
            UserId = userId,
            Code = Clip(r.Code, 50),
            Name = Clip(r.Name, 255),
            Term = Clip(r.Term, 50),
            Color = r.Color != null && Colors.Contains(r.Color) ? r.Color : Colors[(existing + i) % Colors.Length],
            CreatedAt = clock.GetUtcNow(),
        }).ToList();
        db.Courses.AddRange(courses);
        await db.SaveChangesAsync(ct);
        return (courses.Select(c => c.Id).ToList(), null);
    }

    static string Clip(string? text, int max)
    {
        var trimmed = text?.Trim() ?? "";
        return trimmed.Length > max ? trimmed[..max] : trimmed;
    }

    async Task<List<CourseRow>> Rows(IQueryable<Course> courses, CancellationToken ct)
    {
        var userId = me.Id;
        return await courses.OrderBy(c => c.Code).ThenBy(c => c.Name).Select(c => new CourseRow(
            c.Id, c.Code, c.Name, c.Term, c.Color,
            db.Quizzes.Count(q => q.UserId == userId && q.CourseId == c.Id),
            db.Quizzes.Count(q => q.UserId == userId && q.CourseId == c.Id && q.GenerationStatus == GenerationStatus.Success),
            db.Quizzes.Count(q => q.UserId == userId && q.CourseId == c.Id
                && (q.GenerationStatus == GenerationStatus.Queued || q.GenerationStatus == GenerationStatus.Pending)),
            db.Files.Count(f => f.UserId == userId && f.CourseId == c.Id),
            db.Quizzes.Where(q => q.UserId == userId && q.CourseId == c.Id && q.LastScore != null).Average(q => q.LastScore),
            c.CreatedAt)).ToListAsync(ct);
    }
}
