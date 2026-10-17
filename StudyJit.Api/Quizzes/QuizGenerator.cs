using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Data;

namespace StudyJit.Api.Quizzes;

/// <summary>Generates one quiz's questions from its topic and linked files, replacing any it had.</summary>
public class QuizGenerator(ApiDbContext db, OpenAiQuizClient openAi, ILogger<QuizGenerator> log)
{
    static readonly string[] TextExtensions = [".txt", ".md", ".csv", ".json", ".html", ".htm", ".xml", ".rtf"];
    static readonly string[] DocumentExtensions = [".pdf", ".doc", ".docx", ".pptx"];
    static readonly Dictionary<string, string> ImageTypes = new()
    {
        [".png"] = "image/png", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".gif"] = "image/gif", [".webp"] = "image/webp",
    };

    /// <summary>Most text inlined from one file, and images sent, so a request stays within the model's limits.</summary>
    const int MaxTextChars = 150_000;
    const long MaxImageBytes = 10 * 1024 * 1024;
    const int MaxImages = 10;

    public async Task GenerateAsync(int quizId, CancellationToken ct)
    {
        var quiz = await db.Quizzes.FirstOrDefaultAsync(q => q.Id == quizId, ct);
        if (quiz == null)
            return;
        quiz.GenerationStatus = GenerationStatus.Pending;
        quiz.QueueNumber = null;
        await db.SaveChangesAsync(ct);

        try
        {
            var source = new QuizSource { Name = quiz.Name, Description = quiz.Description, Prompt = quiz.Prompt, Questions = quiz.NumQuestions };
            var files = await (from link in db.QuizFiles
                               join file in db.Files on link.FileId equals file.Id
                               where link.QuizId == quizId && file.UserId == quiz.UserId
                               select file).ToListAsync(ct);
            foreach (var file in files)
            {
                if (!File.Exists(file.Path))
                {
                    log.LogWarning("Quiz {QuizId}: {File} is missing on disk.", quizId, file.Path);
                    continue;
                }
                var ext = Path.GetExtension(file.Name).ToLowerInvariant();
                if (TextExtensions.Contains(ext))
                {
                    var text = await File.ReadAllTextAsync(file.Path, ct);
                    source.Texts.Add((file.Name, text.Length > MaxTextChars ? text[..MaxTextChars] : text));
                }
                else if (DocumentExtensions.Contains(ext))
                    source.Documents.Add(file.Path);
                else if (ImageTypes.TryGetValue(ext, out var mime) && file.Size <= MaxImageBytes && source.Images.Count < MaxImages)
                    source.Images.Add((mime, await File.ReadAllBytesAsync(file.Path, ct)));
                // Audio and video aren't read (yet).
            }

            var questions = await openAi.GenerateAsync(source, ct);
            await db.QuizQuestions.Where(q => q.QuizId == quizId).ExecuteDeleteAsync(ct);
            db.QuizQuestions.AddRange(questions.Select(q => new QuizQuestion { QuizId = quizId, Question = q.Question, Options = q.Options, CorrectAnswer = q.Correct }));
            quiz.GenerationStatus = GenerationStatus.Success;
            await db.SaveChangesAsync(ct);
            log.LogInformation("Quiz {QuizId} generated with {Count} questions.", quizId, questions.Count);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning(e, "Quiz {QuizId} generation failed.", quizId);
            db.ChangeTracker.Clear();
            await db.Quizzes.Where(q => q.Id == quizId)
                .ExecuteUpdateAsync(s => s.SetProperty(q => q.GenerationStatus, GenerationStatus.Failed).SetProperty(q => q.QueueNumber, (int?)null), CancellationToken.None);
        }
    }
}
