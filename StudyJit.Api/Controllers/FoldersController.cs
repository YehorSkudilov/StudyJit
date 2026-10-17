using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;
using StudyJit.Api.Files;

namespace StudyJit.Api.Controllers;

public record FolderRow(
    int Id,
    string Name,
    [property: JsonPropertyName("parent_id")] int? ParentId,
    int ItemCount);

public record CreateFolderRequest(
    string? Name,
    [property: JsonPropertyName("parent_id")] int? ParentId,
    string? Context);

public record RenameFolderRequest(string? Name, string? Context);

public record MoveFolderRequest([property: JsonPropertyName("parent_id")] int? ParentId, string? Context);

public record DeleteFoldersRequest(int[] Ids, string? Context);

public record RenameFolderResponse(bool Success, string Name);

public record DeletedResponse(bool Success, int Deleted);

/// <summary>
/// Folders of the learning space (context "quizzes") and of the files page (context "files"); each kind only holds its
/// own items. The routes are the ones the web app has always called.
/// </summary>
[Route("api/items/folders")]
public class FoldersController(ApiDbContext db, ICurrentUser me, FileStorage storage, TimeProvider clock) : ApiControllerBase
{
    /// <summary>The folders directly inside <paramref name="parent"/> ("root" or empty for the top), with how many items each holds.</summary>
    [HttpGet]
    [ProducesResponseType<List<FolderRow>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(string? parent, string? context = FolderContext.Quizzes)
    {
        context ??= FolderContext.Quizzes;
        if (!FolderContext.IsValid(context))
            return BadRequestError("Invalid context.");
        int? parentId = ParseFolder(parent);
        var userId = me.Id;

        var folders = db.Folders.Where(f => f.UserId == userId && f.Context == context && f.ParentId == parentId).OrderBy(f => f.Name);
        var rows = context == FolderContext.Quizzes
            ? folders.Select(f => new FolderRow(f.Id, f.Name, f.ParentId,
                db.Quizzes.Count(q => q.FolderId == f.Id) + db.Folders.Count(c => c.ParentId == f.Id)))
            : folders.Select(f => new FolderRow(f.Id, f.Name, f.ParentId,
                db.Files.Count(x => x.FolderId == f.Id) + db.Folders.Count(c => c.ParentId == f.Id)));
        return Ok(await rows.ToListAsync());
    }

    [HttpPost]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(CreateFolderRequest request)
    {
        var context = request.Context ?? FolderContext.Quizzes;
        if (!FolderContext.IsValid(context))
            return BadRequestError("Invalid context.");
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name))
            return BadRequestError("Folder name required.");
        if (request.ParentId != null && !await OwnsFolder(request.ParentId.Value, context))
            return NotFoundError("Parent folder not found.");
        if (await NameTaken(name, request.ParentId, context, exceptId: null))
            return ConflictError("A folder with this name already exists here.");

        db.Folders.Add(new Folder { UserId = me.Id, Name = name, ParentId = request.ParentId, Context = context, CreatedAt = clock.GetUtcNow() });
        await db.SaveChangesAsync();
        return Ok(Success());
    }

    [HttpPatch("rename/{id:int}")]
    [ProducesResponseType<RenameFolderResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Rename(int id, RenameFolderRequest request)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name))
            return BadRequestError("Folder name required.");
        var folder = await FindFolder(id, request.Context);
        if (folder == null)
            return NotFoundError("Folder not found.");
        if (await NameTaken(name, folder.ParentId, folder.Context, exceptId: id))
            return ConflictError("Duplicate folder name.");

        folder.Name = name;
        await db.SaveChangesAsync();
        return Ok(new RenameFolderResponse(true, name));
    }

    /// <summary>Moves a folder into another (or to the top with a null parent_id).</summary>
    [HttpPatch("move/{id:int}")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Move(int id, MoveFolderRequest request)
    {
        var folder = await FindFolder(id, request.Context);
        if (folder == null)
            return NotFoundError("Folder not found.");
        if (request.ParentId != null)
        {
            if (!await OwnsFolder(request.ParentId.Value, folder.Context))
                return NotFoundError("Target folder not found.");
            // Into itself or one of its own subfolders would cut the tree off from the top.
            for (int? at = request.ParentId; at != null; at = await db.Folders.Where(f => f.Id == at).Select(f => f.ParentId).FirstOrDefaultAsync())
                if (at == id)
                    return BadRequestError("Cannot move a folder into itself.");
        }

        folder.ParentId = request.ParentId;
        await db.SaveChangesAsync();
        return Ok(Success());
    }

    /// <summary>Deletes the folders, their subfolders and everything in them (quizzes, or files and their contents on disk).</summary>
    [HttpPost("delete")]
    [ProducesResponseType<DeletedResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(DeleteFoldersRequest request, CancellationToken ct)
    {
        if (request.Ids is not { Length: > 0 })
            return BadRequestError("No folder IDs provided.");
        if (!FolderContext.IsValid(request.Context))
            return BadRequestError("Invalid context.");
        var userId = me.Id;

        var all = await db.Folders.Where(f => f.UserId == userId && f.Context == request.Context && request.Ids.Contains(f.Id))
            .Select(f => f.Id).ToListAsync(ct);
        for (var level = all.ToList(); level.Count > 0;)
        {
            level = await db.Folders.Where(f => f.ParentId != null && level.Contains(f.ParentId.Value)).Select(f => f.Id).ToListAsync(ct);
            all.AddRange(level);
        }

        if (request.Context == FolderContext.Quizzes)
            await db.Quizzes.Where(q => q.UserId == userId && q.FolderId != null && all.Contains(q.FolderId.Value)).ExecuteDeleteAsync(ct);
        else
        {
            var files = await db.Files.Where(f => f.UserId == userId && f.FolderId != null && all.Contains(f.FolderId.Value)).ToListAsync(ct);
            db.Files.RemoveRange(files);
            await db.SaveChangesAsync(ct);
            foreach (var file in files)
                storage.Delete(file.Path);
        }

        // Subfolders go with their parents (cascade).
        var deleted = await db.Folders.Where(f => f.UserId == userId && all.Contains(f.Id)).ExecuteDeleteAsync(ct);
        return Ok(new DeletedResponse(true, deleted));
    }

    /// <summary>"root", empty or not a number: the top level.</summary>
    internal static int? ParseFolder(string? value) => int.TryParse(value, out var id) ? id : null;

    Task<Folder?> FindFolder(int id, string? context)
    {
        var userId = me.Id;
        var query = db.Folders.Where(f => f.Id == id && f.UserId == userId);
        if (FolderContext.IsValid(context))
            query = query.Where(f => f.Context == context);
        return query.FirstOrDefaultAsync();
    }

    Task<bool> OwnsFolder(int id, string context)
    {
        var userId = me.Id;
        return db.Folders.AnyAsync(f => f.Id == id && f.UserId == userId && f.Context == context);
    }

    Task<bool> NameTaken(string name, int? parentId, string context, int? exceptId)
    {
        var userId = me.Id;
        return db.Folders.AnyAsync(f => f.UserId == userId && f.Context == context && f.ParentId == parentId && f.Name == name && f.Id != exceptId);
    }
}
