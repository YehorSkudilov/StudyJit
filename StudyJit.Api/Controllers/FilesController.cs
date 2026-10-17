using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;
using StudyJit.Api.Files;
using StudyJit.Api.Quizzes;

namespace StudyJit.Api.Controllers;

public record FileRow(
    int Id,
    string Name,
    [property: JsonPropertyName("folder_id")] int? FolderId,
    [property: JsonPropertyName("course_id")] int? CourseId,
    long Size,
    [property: JsonPropertyName("mime_type")] string? MimeType,
    [property: JsonPropertyName("uploaded_at")] DateTimeOffset UploadedAt);

public record MoveItemRequest([property: JsonPropertyName("folder_id")] int? FolderId);

public record DeleteItemsRequest(int[] Ids);

public record YouTubeRequest(string? Url, string? Folder, int? Course = null);

public record ChunkResponse(bool Success, long Start, long End, long Total, int? FolderId);

public record DeletedFileResponse(bool Success, int Id);

/// <summary>The user's files: uploads (in chunks) and YouTube downloads, which quizzes are generated from.</summary>
[Route("api/items/files")]
public partial class FilesController(ApiDbContext db, ICurrentUser me, FileStorage storage, TimeProvider clock, IOptions<JsonOptions> json,
    StudySetSync studySets) : ApiControllerBase
{
    /// <summary>Most a chunk may be (the web app sends 5 MB).</summary>
    const int MaxChunkBytes = 16 * 1024 * 1024;

    /// <summary>Every file, or with course={id} a course's, newest first (the web app picks a folder's own).</summary>
    [HttpGet]
    [ProducesResponseType<List<FileRow>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(int? course)
    {
        var userId = me.Id;
        var files = db.Files.Where(f => f.UserId == userId);
        if (course != null)
            files = files.Where(f => f.CourseId == course);
        return Ok(await files.OrderByDescending(f => f.UploadedAt)
            .Select(f => new FileRow(f.Id, f.Name, f.FolderId, f.CourseId, f.Size, f.MimeType, f.UploadedAt)).ToListAsync());
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType<DeletedFileResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = me.Id;
        var file = await db.Files.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
        if (file == null)
            return NotFoundError("File not found.");
        db.Files.Remove(file);
        await db.SaveChangesAsync();
        storage.Delete(file.Path);
        await studySets.FoldersChangedAsync([file.FolderId], HttpContext.RequestAborted);
        return Ok(new DeletedFileResponse(true, id));
    }

    [HttpPost("delete")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteMany(DeleteItemsRequest request)
    {
        if (request.Ids is not { Length: > 0 })
            return BadRequestError("No file IDs provided.");
        var userId = me.Id;
        var files = await db.Files.Where(f => f.UserId == userId && request.Ids.Contains(f.Id)).ToListAsync();
        db.Files.RemoveRange(files);
        await db.SaveChangesAsync();
        foreach (var file in files)
            storage.Delete(file.Path);
        await studySets.FoldersChangedAsync(files.Select(f => f.FolderId), HttpContext.RequestAborted);
        return Ok(Success());
    }

    /// <summary>Moves a file into a files folder (or to the top with a null folder_id).</summary>
    [HttpPatch("move/{id:int}")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Move(int id, MoveItemRequest request)
    {
        var userId = me.Id;
        if (request.FolderId != null && !await db.Folders.AnyAsync(f => f.Id == request.FolderId && f.UserId == userId && f.Context == FolderContext.Files))
            return NotFoundError("Folder not found.");
        var moved = await db.Files.Where(f => f.Id == id && f.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.FolderId, request.FolderId));
        return moved == 0 ? NotFoundError("File not found.") : Ok(Success());
    }

    /// <summary>
    /// Two uses, told apart by Content-Type:
    /// <list type="bullet">
    ///   <item>A chunk of a file: the raw bytes, with Content-Range (bytes start-end/total), X-Filename (URL-encoded) and
    ///   X-Folder (a folder id or "root"). Chunks come in order; the file is listed once the last one arrives.</item>
    ///   <item>application/json { url, folder }: downloads a YouTube video, answering with server-sent events
    ///   ({ percent }, then { status: "complete" } or { status: "error", error }).</item>
    /// </list>
    /// </summary>
    [HttpPost("upload")]
    [RequestSizeLimit(MaxChunkBytes)]
    [RawBody]
    [ProducesResponseType<ChunkResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Upload([FromServices] YouTubeDownloader youTube, CancellationToken ct)
    {
        if (Request.ContentType?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true)
        {
            var request = await JsonSerializer.DeserializeAsync<YouTubeRequest>(Request.Body, json.Value.JsonSerializerOptions, ct);
            if (string.IsNullOrWhiteSpace(request?.Url))
                return BadRequestError("Missing YouTube URL.");
            if (request.Course != null && !await CoursesController.Owns(db, me.Id, request.Course.Value, ct))
                return NotFoundError("Course not found.");
            await DownloadYouTube(youTube, request.Url.Trim(), FoldersController.ParseFolder(request.Folder), request.Course, ct);
            return new EmptyResult();
        }

        var range = ContentRangePattern().Match(Request.Headers.ContentRange.ToString());
        var fileName = Uri.UnescapeDataString(Request.Headers["X-Filename"].ToString());
        if (!range.Success || fileName.Length == 0)
            return BadRequestError("Missing or invalid Content-Range or X-Filename header.");
        var start = long.Parse(range.Groups[1].Value);
        var end = long.Parse(range.Groups[2].Value);
        var total = long.Parse(range.Groups[3].Value);
        if (end < start || end >= total)
            return BadRequestError("Invalid Content-Range header.");

        var userId = me.Id;
        var folderId = FoldersController.ParseFolder(Request.Headers["X-Folder"].ToString());
        if (folderId != null && !await db.Folders.AnyAsync(f => f.Id == folderId && f.UserId == userId && f.Context == FolderContext.Files, ct))
            return NotFoundError("Folder not found.");
        int? courseId = int.TryParse(Request.Headers["X-Course"].ToString(), out var c) ? c : null;
        if (courseId != null && !await CoursesController.Owns(db, userId, courseId.Value, ct))
            return NotFoundError("Course not found.");
        if (folderId != null && courseId != null && !await db.Folders.AnyAsync(f => f.Id == folderId && f.CourseId == courseId, ct))
            return NotFoundError("Folder not found in this course.");

        var path = storage.PathFor(userId, fileName);
        if (start > 0 && (!System.IO.File.Exists(path) || new FileInfo(path).Length != start))
            return ConflictError("Chunks arrived out of order. Please upload the file again.");

        await using (var stream = new FileStream(path, start == 0 ? FileMode.Create : FileMode.Append, FileAccess.Write))
            await Request.Body.CopyToAsync(stream, ct);

        if (end + 1 >= total)
            await AddFile(userId, path, folderId, courseId, ct);
        return Ok(new ChunkResponse(true, start, end, total, folderId));
    }

    async Task DownloadYouTube(YouTubeDownloader youTube, string url, int? folderId, int? courseId, CancellationToken ct)
    {
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();
        Response.ContentType = "text/event-stream; charset=utf-8";
        Response.Headers.CacheControl = "no-cache, no-transform";
        // Keeps nginx (the reverse proxy) from holding the events back.
        Response.Headers["X-Accel-Buffering"] = "no";

        async Task Send(object message)
        {
            await Response.WriteAsync($"data: {JsonSerializer.Serialize(message, json.Value.JsonSerializerOptions)}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }

        var userId = me.Id;
        try
        {
            if (folderId != null && !await db.Folders.AnyAsync(f => f.Id == folderId && f.UserId == userId && f.Context == FolderContext.Files, ct))
                throw new InvalidOperationException("Folder not found.");
            var path = await youTube.DownloadAsync(userId, url, percent => Send(new { percent = Math.Round(percent, 1) }), ct);
            await Send(new { status = "merging" });
            await AddFile(userId, path, folderId, courseId, ct);
            await Send(new { percent = 100, status = "complete" });
        }
        catch (InvalidOperationException e)
        {
            await Send(new { status = "error", error = e.Message });
        }
    }

    async Task AddFile(string userId, string path, int? folderId, int? courseId, CancellationToken ct)
    {
        var name = Path.GetFileName(path);
        // Uploading a file with the same name again replaces it.
        var existing = await db.Files.FirstOrDefaultAsync(f => f.UserId == userId && f.Path == path, ct);
        var previousFolder = existing?.FolderId;
        var file = existing ?? db.Files.Add(new StoredFile { UserId = userId, Path = path }).Entity;
        file.Name = name;
        file.FolderId = folderId;
        file.CourseId = courseId ?? file.CourseId;
        file.Size = new FileInfo(path).Length;
        file.MimeType = FileStorage.MimeTypeOf(name);
        file.UploadedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        // A file landing in (or leaving) a course folder regenerates that folder's study set.
        await studySets.FoldersChangedAsync([previousFolder, file.FolderId], ct);
    }

    [GeneratedRegex(@"^bytes (\d+)-(\d+)/(\d+)$")]
    private static partial Regex ContentRangePattern();
}

/// <summary>
/// The action reads the request body itself: keeps MVC from reading it first as a form (a chunk sent with a form
/// Content-Type would otherwise be consumed, or refused as too many form values).
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public class RawBodyAttribute : Attribute, Microsoft.AspNetCore.Mvc.Filters.IResourceFilter
{
    public void OnResourceExecuting(Microsoft.AspNetCore.Mvc.Filters.ResourceExecutingContext context)
    {
        var factories = context.ValueProviderFactories;
        factories.RemoveType<FormValueProviderFactory>();
        factories.RemoveType<FormFileValueProviderFactory>();
        factories.RemoveType<JQueryFormValueProviderFactory>();
    }

    public void OnResourceExecuted(Microsoft.AspNetCore.Mvc.Filters.ResourceExecutedContext context)
    {
    }
}
