using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Data;

namespace StudyJit.Api.Quizzes;

/// <summary>
/// Keeps a course's study sets in step with its folders: each folder with files has one study set, made and generated
/// on its own, and regenerated (with the exams built on it) whenever the folder's files change.
/// </summary>
public class StudySetSync(ApiDbContext db, QuizGenerationQueue queue, OpenAiQuizClient openAi, TimeProvider clock)
{
    public const int DefaultQuestions = 20;

    /// <summary>
    /// After files were added to, removed from or moved between these folders: makes the study set of a folder that
    /// has files and none yet, deletes the set of one left empty, and queues the rest for regenerating.
    /// </summary>
    public async Task FoldersChangedAsync(IEnumerable<int?> folderIds, CancellationToken ct)
    {
        var ids = folderIds.OfType<int>().Distinct().ToList();
        if (ids.Count == 0)
            return;
        var folders = await db.Folders.Where(f => ids.Contains(f.Id) && f.CourseId != null).ToListAsync(ct);
        var toQueue = new List<Quiz>();
        foreach (var folder in folders)
        {
            var hasFiles = await db.Files.AnyAsync(f => f.FolderId == folder.Id, ct);
            var set = await SetOf(folder.Id, ct);
            if (!hasFiles)
            {
                if (set != null)
                    await RemoveSetAsync(set, ct);
                continue;
            }
            if (set == null)
            {
                set = new Quiz
                {
                    UserId = folder.UserId,
                    CourseId = folder.CourseId,
                    FolderId = folder.Id,
                    Kind = QuizKind.Set,
                    Name = folder.Name,
                    Description = "",
                    Prompt = "",
                    NumQuestions = DefaultQuestions,
                    CreatedAt = clock.GetUtcNow(),
                };
                db.Quizzes.Add(set);
            }
            toQueue.Add(set);
        }
        await db.SaveChangesAsync(ct);
        await QueueAsync(toQueue, ct);
    }

    /// <summary>The folder's study set takes its new name.</summary>
    public async Task FolderRenamedAsync(Folder folder, CancellationToken ct)
    {
        var name = folder.Name;
        await db.Quizzes.Where(q => q.FolderId == folder.Id && q.Kind == QuizKind.Set).ExecuteUpdateAsync(s => s.SetProperty(q => q.Name, name), ct);
    }

    /// <summary>Before a folder is deleted: its study set goes with it.</summary>
    public async Task FolderDeletingAsync(int folderId, CancellationToken ct)
    {
        if (await SetOf(folderId, ct) is { } set)
            await RemoveSetAsync(set, ct);
    }

    /// <summary>
    /// Deletes a study set. The exams built on it are rebuilt without it; one left covering nothing keeps the questions
    /// it has.
    /// </summary>
    async Task RemoveSetAsync(Quiz set, CancellationToken ct)
    {
        var exams = await ExamsOn(set.Id, ct);
        foreach (var exam in exams)
            exam.SourceQuizIds = exam.SourceQuizIds.Where(id => id != set.Id).ToList();
        db.Quizzes.Remove(set);
        await db.SaveChangesAsync(ct);
        await QueueAsync(exams.Where(e => e.SourceQuizIds.Count > 0).ToList(), ct);
    }

    /// <summary>
    /// Queues the quizzes for (re)generation. The exams built on a study set follow once it's done (see
    /// <see cref="SetGeneratedAsync"/>), so they're written from its new material.
    /// </summary>
    async Task QueueAsync(List<Quiz> quizzes, CancellationToken ct)
    {
        if (!openAi.IsConfigured || quizzes.Count == 0)
            return;
        foreach (var quiz in quizzes.Where(q => q.GenerationStatus != GenerationStatus.Pending))
            quiz.GenerationStatus = GenerationStatus.Queued;
        await db.SaveChangesAsync(ct);
        foreach (var quiz in quizzes)
            await queue.EnqueueAsync(quiz.Id, ct);
    }

    /// <summary>After a study set is (re)generated, however that started: the exams that cover it are rebuilt.</summary>
    public async Task SetGeneratedAsync(int setId, CancellationToken ct) => await QueueAsync(await ExamsOn(setId, ct), ct);

    Task<Quiz?> SetOf(int folderId, CancellationToken ct) =>
        db.Quizzes.FirstOrDefaultAsync(q => q.FolderId == folderId && q.Kind == QuizKind.Set, ct);

    Task<List<Quiz>> ExamsOn(int setId, CancellationToken ct) =>
        db.Quizzes.Where(q => q.Kind == QuizKind.Exam && q.SourceQuizIds.Contains(setId)).ToListAsync(ct);
}
