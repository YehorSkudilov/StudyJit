using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;

namespace StudyJit.Api.Controllers;

public record QuestionDto(int Id, string Question, List<string> Options, string Correct);

public record QuizSummary(
    int Id,
    string Name,
    string? Description,
    [property: JsonPropertyName("generation_status")] string GenerationStatus,
    [property: JsonPropertyName("num_questions")] int NumQuestions,
    [property: JsonPropertyName("folder_id")] int? FolderId,
    [property: JsonPropertyName("last_score")] decimal? LastScore,
    List<QuestionDto> Questions);

public record QuizDetail(
    int Id,
    string Name,
    string? Description,
    string? Prompt,
    [property: JsonPropertyName("num_questions")] int NumQuestions,
    [property: JsonPropertyName("generation_status")] string GenerationStatus,
    [property: JsonPropertyName("last_score")] decimal? LastScore,
    [property: JsonPropertyName("queue_number")] int? QueueNumber,
    List<QuestionDto> Questions);

public record CreateQuizRequest(
    string? Name,
    string? Description,
    string? Prompt,
    int? NumQuestions,
    [property: JsonPropertyName("folder_id")] int? FolderId);

public record CreateQuizResponse(bool Success, int QuizId, int? FolderId, string Message);

public record UpdateQuizRequest(int Id, string? Name, string? Description, string? Prompt, int? NumQuestions, decimal? LastScore);

public record SuccessMessageResponse(bool Success, string Message);

public record QuizFileRow(int Id, string Name);

public record AddQuizFileRequest(int QuizId, int FileId);

public record AddQuizFileResponse(bool Success, QuizFileRow? File, string? Message = null);

public record RemoveQuizFileRequest(
    [property: JsonPropertyName("quiz_id")] int QuizId,
    [property: JsonPropertyName("file_id")] int FileId);

/// <summary>Quizzes in the learning space, their questions, and the files they're generated from.</summary>
[Route("api/items/quizzes")]
public class QuizzesController(ApiDbContext db, ICurrentUser me, TimeProvider clock) : ApiControllerBase
{
    public const int MaxQuestions = 50;

    /// <summary>The quizzes in a folder ("root" or empty for the top), newest first, with their questions.</summary>
    [HttpGet("getAll")]
    [ProducesResponseType<List<QuizSummary>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(string? folder)
    {
        var userId = me.Id;
        var folderId = FoldersController.ParseFolder(folder);
        var quizzes = await db.Quizzes.AsNoTracking().Include(q => q.Questions)
            .Where(q => q.UserId == userId && q.FolderId == folderId)
            .OrderByDescending(q => q.Id).ToListAsync();
        return Ok(quizzes.Select(q => new QuizSummary(q.Id, q.Name, q.Description, q.GenerationStatus, q.NumQuestions, q.FolderId,
            q.LastScore, Questions(q))));
    }

    [HttpGet("get/{id:int}")]
    [ProducesResponseType<QuizDetail>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(int id)
    {
        var userId = me.Id;
        var q = await db.Quizzes.AsNoTracking().Include(x => x.Questions).FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (q == null)
            return NotFoundError("Quiz not found.");
        return Ok(new QuizDetail(q.Id, q.Name, q.Description, q.Prompt, q.NumQuestions, q.GenerationStatus, q.LastScore, q.QueueNumber, Questions(q)));
    }

    [HttpPost("create")]
    [ProducesResponseType<CreateQuizResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Create(CreateQuizRequest request)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name))
            return BadRequestError("Quiz name is required.");
        if (request.FolderId != null && !await OwnsQuizFolder(request.FolderId.Value))
            return NotFoundError("Folder not found.");

        var quiz = new Quiz
        {
            UserId = me.Id,
            FolderId = request.FolderId,
            Name = name,
            Description = request.Description ?? "",
            Prompt = request.Prompt ?? "",
            NumQuestions = Math.Clamp(request.NumQuestions ?? 10, 1, MaxQuestions),
            CreatedAt = clock.GetUtcNow(),
        };
        db.Quizzes.Add(quiz);
        await db.SaveChangesAsync();
        return Ok(new CreateQuizResponse(true, quiz.Id, quiz.FolderId, "Quiz created successfully"));
    }

    /// <summary>Changes the fields that are sent; lastScore records the latest attempt's score.</summary>
    [HttpPatch("update")]
    [ProducesResponseType<SuccessMessageResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(UpdateQuizRequest request)
    {
        var quiz = await FindQuiz(request.Id);
        if (quiz == null)
            return NotFoundError("Quiz not found.");

        if (request.Name != null)
        {
            if (request.Name.Trim().Length == 0)
                return BadRequestError("Quiz name is required.");
            quiz.Name = request.Name.Trim();
        }
        if (request.Description != null)
            quiz.Description = request.Description;
        if (request.Prompt != null)
            quiz.Prompt = request.Prompt;
        if (request.NumQuestions != null)
            quiz.NumQuestions = Math.Clamp(request.NumQuestions.Value, 1, MaxQuestions);
        if (request.LastScore != null)
            quiz.LastScore = Math.Clamp(request.LastScore.Value, 0, 999.99m);

        await db.SaveChangesAsync();
        return Ok(new SuccessMessageResponse(true, request.LastScore != null ? "Quiz updated successfully (score updated)" : "Quiz updated successfully"));
    }

    /// <summary>Moves a quiz into a learning space folder (or to the top with a null folder_id).</summary>
    [HttpPatch("move/{id:int}")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Move(int id, MoveItemRequest request)
    {
        if (request.FolderId != null && !await OwnsQuizFolder(request.FolderId.Value))
            return NotFoundError("Folder not found.");
        var userId = me.Id;
        var moved = await db.Quizzes.Where(q => q.Id == id && q.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(q => q.FolderId, request.FolderId));
        return moved == 0 ? NotFoundError("Quiz not found.") : Ok(Success());
    }

    [HttpPost("delete")]
    [ProducesResponseType<DeletedResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Delete(DeleteItemsRequest request)
    {
        if (request.Ids is not { Length: > 0 })
            return BadRequestError("No quiz IDs provided.");
        var userId = me.Id;
        var deleted = await db.Quizzes.Where(q => q.UserId == userId && request.Ids.Contains(q.Id)).ExecuteDeleteAsync();
        return Ok(new DeletedResponse(true, deleted));
    }

    /// <summary>The files a quiz is generated from.</summary>
    [HttpGet("files/get/{id:int}")]
    [ProducesResponseType<List<QuizFileRow>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Files(int id)
    {
        if (await FindQuiz(id) == null)
            return NotFoundError("Quiz not found.");
        var files = await (from link in db.QuizFiles
                           join file in db.Files on link.FileId equals file.Id
                           where link.QuizId == id
                           orderby file.UploadedAt descending
                           select new QuizFileRow(file.Id, file.Name)).ToListAsync();
        return Ok(files);
    }

    [HttpPost("files/add")]
    [ProducesResponseType<AddQuizFileResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> AddFile(AddQuizFileRequest request)
    {
        var userId = me.Id;
        if (await FindQuiz(request.QuizId) == null)
            return NotFoundError("Quiz not found.");
        var file = await db.Files.Where(f => f.Id == request.FileId && f.UserId == userId).Select(f => new QuizFileRow(f.Id, f.Name)).FirstOrDefaultAsync();
        if (file == null)
            return NotFoundError("File not found.");
        if (await db.QuizFiles.AnyAsync(l => l.QuizId == request.QuizId && l.FileId == request.FileId))
            return Ok(new AddQuizFileResponse(false, file, "File already linked to this quiz."));

        db.QuizFiles.Add(new QuizFile { QuizId = request.QuizId, FileId = request.FileId, LinkedAt = clock.GetUtcNow() });
        await db.SaveChangesAsync();
        return Ok(new AddQuizFileResponse(true, file));
    }

    /// <summary>Unlinks a file from a quiz; the file itself stays.</summary>
    [HttpPost("files/remove")]
    [ProducesResponseType<SuccessMessageResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> RemoveFile(RemoveQuizFileRequest request)
    {
        if (await FindQuiz(request.QuizId) == null)
            return NotFoundError("Quiz not found.");
        var removed = await db.QuizFiles.Where(l => l.QuizId == request.QuizId && l.FileId == request.FileId).ExecuteDeleteAsync();
        return Ok(removed == 0
            ? new SuccessMessageResponse(false, "No matching link found")
            : new SuccessMessageResponse(true, "File unlinked successfully"));
    }

    static List<QuestionDto> Questions(Quiz quiz) =>
        quiz.Questions.OrderBy(x => x.Id).Select(x => new QuestionDto(x.Id, x.Question, x.Options, x.CorrectAnswer)).ToList();

    Task<Quiz?> FindQuiz(int id)
    {
        var userId = me.Id;
        return db.Quizzes.FirstOrDefaultAsync(q => q.Id == id && q.UserId == userId);
    }

    Task<bool> OwnsQuizFolder(int id)
    {
        var userId = me.Id;
        return db.Folders.AnyAsync(f => f.Id == id && f.UserId == userId && f.Context == FolderContext.Quizzes);
    }
}
