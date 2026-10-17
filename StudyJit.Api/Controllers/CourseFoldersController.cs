using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;
using StudyJit.Api.Quizzes;

namespace StudyJit.Api.Controllers;

public record CourseFolderRow(int Id, string Name, [property: JsonPropertyName("file_count")] int FileCount);

public record CourseFolderRequest(string? Name);

public record MoveFilesRequest(
    [property: JsonPropertyName("file_ids")] int[] FileIds,
    [property: JsonPropertyName("folder_id")] int? FolderId);

public record FolderPlan(string Name, [property: JsonPropertyName("file_ids")] List<int> FileIds);

public record ApplyFoldersRequest(List<FolderPlan> Folders);

/// <summary>
/// A course's file folders (e.g. one per week): flat, and only for that course's files. Each folder with files has its
/// own study set, kept in step by <see cref="StudySetSync"/>.
/// </summary>
[Route("api/courses/{id:int}")]
public class CourseFoldersController(ApiDbContext db, ICurrentUser me, TimeProvider clock, StudySetSync studySets) : ApiControllerBase
{
    public const int MaxFolders = 60;

    [HttpGet("folders")]
    [ProducesResponseType<List<CourseFolderRow>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(int id, CancellationToken ct)
    {
        if (!await CoursesController.Owns(db, me.Id, id, ct))
            return NotFoundError("Course not found.");
        return Ok(await Rows(id, ct));
    }

    [HttpPost("folders")]
    [ProducesResponseType<CourseFolderRow>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Create(int id, CourseFolderRequest request, CancellationToken ct)
    {
        var name = Clean(request.Name);
        if (name.Length == 0)
            return BadRequestError("Folder name is required.");
        if (!await CoursesController.Owns(db, me.Id, id, ct))
            return NotFoundError("Course not found.");
        if (await Folders(id).CountAsync(ct) >= MaxFolders)
            return BadRequestError($"A course can have up to {MaxFolders} folders.");
        if (await Folders(id).AnyAsync(f => f.Name == name, ct))
            return ConflictError("There's already a folder with that name.");
        var folder = Add(id, name);
        await db.SaveChangesAsync(ct);
        return Ok(new CourseFolderRow(folder.Id, folder.Name, 0));
    }

    [HttpPatch("folders/{folderId:int}")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Rename(int id, int folderId, CourseFolderRequest request, CancellationToken ct)
    {
        var name = Clean(request.Name);
        if (name.Length == 0)
            return BadRequestError("Folder name is required.");
        var folder = await Folders(id).FirstOrDefaultAsync(f => f.Id == folderId, ct);
        if (folder == null)
            return NotFoundError("Folder not found.");
        if (await Folders(id).AnyAsync(f => f.Name == name && f.Id != folderId, ct))
            return ConflictError("There's already a folder with that name.");
        folder.Name = name;
        await db.SaveChangesAsync(ct);
        await studySets.FolderRenamedAsync(folder, ct);
        return Ok(Success());
    }

    /// <summary>Deletes the folder and its study set; its files stay in the course, unsorted.</summary>
    [HttpDelete("folders/{folderId:int}")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(int id, int folderId, CancellationToken ct)
    {
        var userId = me.Id;
        if (!await Folders(id).AnyAsync(f => f.Id == folderId, ct))
            return NotFoundError("Folder not found.");
        await studySets.FolderDeletingAsync(folderId, ct);
        await db.Files.Where(f => f.UserId == userId && f.FolderId == folderId).ExecuteUpdateAsync(s => s.SetProperty(f => f.FolderId, (int?)null), ct);
        await Folders(id).Where(f => f.Id == folderId).ExecuteDeleteAsync(ct);
        return Ok(Success());
    }

    /// <summary>Moves course files into a folder of the course, or out of any (folder_id null).</summary>
    [HttpPost("files/move")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> MoveFiles(int id, MoveFilesRequest request, CancellationToken ct)
    {
        if (!await CoursesController.Owns(db, me.Id, id, ct))
            return NotFoundError("Course not found.");
        if (request.FolderId != null && !await Folders(id).AnyAsync(f => f.Id == request.FolderId, ct))
            return NotFoundError("Folder not found.");
        var moving = CourseFiles(id).Where(f => request.FileIds.Contains(f.Id));
        var from = await moving.Select(f => f.FolderId).Distinct().ToListAsync(ct);
        await moving.ExecuteUpdateAsync(s => s.SetProperty(f => f.FolderId, request.FolderId), ct);
        await studySets.FoldersChangedAsync(from.Append(request.FolderId), ct);
        return Ok(Success());
    }

    /// <summary>Applies a folder layout (e.g. the AI's): makes the folders that don't exist yet and moves the files in.</summary>
    [HttpPost("folders/apply")]
    [ProducesResponseType<List<CourseFolderRow>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Apply(int id, ApplyFoldersRequest request, CancellationToken ct)
    {
        if (!await CoursesController.Owns(db, me.Id, id, ct))
            return NotFoundError("Course not found.");
        var plans = (request.Folders ?? []).Select(p => p with { Name = Clean(p.Name) }).Where(p => p.Name.Length > 0).ToList();
        var existing = await Folders(id).ToListAsync(ct);
        if (existing.Count + plans.Count(p => existing.All(f => f.Name != p.Name)) > MaxFolders)
            return BadRequestError($"A course can have up to {MaxFolders} folders.");

        var folders = plans.ToDictionary(p => p.Name, p => existing.FirstOrDefault(f => f.Name == p.Name) ?? Add(id, p.Name));
        await db.SaveChangesAsync(ct);
        var files = await CourseFiles(id).ToListAsync(ct);
        var touched = new List<int?>();
        foreach (var plan in plans)
            foreach (var file in files.Where(f => plan.FileIds.Contains(f.Id) && f.FolderId != folders[plan.Name].Id))
            {
                touched.Add(file.FolderId);
                file.FolderId = folders[plan.Name].Id;
                touched.Add(file.FolderId);
            }
        await db.SaveChangesAsync(ct);
        await studySets.FoldersChangedAsync(touched, ct);
        return Ok(await Rows(id, ct));
    }

    Folder Add(int courseId, string name) =>
        db.Folders.Add(new Folder { UserId = me.Id, CourseId = courseId, Context = FolderContext.Files, Name = name, CreatedAt = clock.GetUtcNow() }).Entity;

    IQueryable<Folder> Folders(int courseId)
    {
        var userId = me.Id;
        return db.Folders.Where(f => f.UserId == userId && f.CourseId == courseId);
    }

    IQueryable<StoredFile> CourseFiles(int courseId)
    {
        var userId = me.Id;
        return db.Files.Where(f => f.UserId == userId && f.CourseId == courseId);
    }

    Task<List<CourseFolderRow>> Rows(int courseId, CancellationToken ct) =>
        Folders(courseId).OrderBy(f => f.Name)
            .Select(f => new CourseFolderRow(f.Id, f.Name, db.Files.Count(x => x.FolderId == f.Id))).ToListAsync(ct);

    static string Clean(string? name)
    {
        var trimmed = name?.Trim() ?? "";
        return trimmed.Length > 255 ? trimmed[..255] : trimmed;
    }
}
