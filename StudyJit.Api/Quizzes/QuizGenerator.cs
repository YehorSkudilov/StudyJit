using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Data;

namespace StudyJit.Api.Quizzes;

/// <summary>Generates one quiz's questions, study guide and key terms from its topic and linked files, replacing any it had.</summary>
public class QuizGenerator(ApiDbContext db, OpenAiQuizClient openAi, StudySetSync studySets, ILogger<QuizGenerator> log)
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
            var source = new QuizSource { Name = quiz.Name, Description = quiz.Description, Prompt = quiz.Prompt, IsExam = quiz.Kind == QuizKind.Exam };
            // The quiz's own files; a study set's folder's files; and an exam's study sets' files, guides and cheat sheets.
            var sources = quiz.Kind == QuizKind.Exam && quiz.SourceQuizIds.Count > 0
                ? await db.Quizzes.AsNoTracking().Where(q => quiz.SourceQuizIds.Contains(q.Id) && q.UserId == quiz.UserId).ToListAsync(ct)
                : [];
            var quizIds = sources.Select(q => q.Id).Append(quizId).ToList();
            var folderIds = sources.Select(q => q.FolderId).Append(quiz.FolderId).OfType<int>().ToList();
            var files = await db.Files.Where(f => f.UserId == quiz.UserId && (
                    db.QuizFiles.Any(l => l.FileId == f.Id && quizIds.Contains(l.QuizId))
                    || (f.FolderId != null && folderIds.Contains(f.FolderId.Value) && f.CourseId == quiz.CourseId)))
                .ToListAsync(ct);
            foreach (var set in sources.Where(s => !string.IsNullOrWhiteSpace(s.Summary)))
                source.Texts.Add(($"Study guide: {set.Name}", set.Summary!));
            foreach (var set in sources.Where(s => !string.IsNullOrWhiteSpace(s.CheatSheet)))
                source.Texts.Add(($"Cheat sheet: {set.Name}", set.CheatSheet!));
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

            var generated = await openAi.GenerateAsync(source, ct);
            await db.QuizQuestions.Where(q => q.QuizId == quizId).ExecuteDeleteAsync(ct);
            await db.QuizTerms.Where(t => t.QuizId == quizId).ExecuteDeleteAsync(ct);
            await db.QuizStatements.Where(s => s.QuizId == quizId).ExecuteDeleteAsync(ct);
            await db.QuizShortAnswers.Where(s => s.QuizId == quizId).ExecuteDeleteAsync(ct);
            db.QuizQuestions.AddRange(generated.Questions.Select(q => new QuizQuestion
            {
                QuizId = quizId, Question = q.Question, Options = q.Options, CorrectAnswer = q.Correct, Explanation = q.Explanation,
            }));
            db.QuizTerms.AddRange(generated.Terms.Select(t => new QuizTerm { QuizId = quizId, Term = t.Term, Definition = t.Definition }));
            db.QuizStatements.AddRange(generated.Statements.Select(s => new QuizStatement
            {
                QuizId = quizId, Statement = s.Statement, IsTrue = s.IsTrue, Explanation = s.Explanation,
            }));
            db.QuizShortAnswers.AddRange(generated.ShortAnswers.Select(s => new QuizShortAnswer
            {
                QuizId = quizId, Question = s.Question, Answer = s.Answer, Alternatives = s.Alternatives, Explanation = s.Explanation,
            }));
            quiz.Summary = generated.Summary;
            quiz.CheatSheet = generated.CheatSheet;
            quiz.GenerationStatus = GenerationStatus.Success;
            await db.SaveChangesAsync(ct);
            log.LogInformation("Quiz {QuizId} generated with {Count} questions and {Terms} terms.", quizId, generated.Questions.Count, generated.Terms.Count);
            if (quiz.Kind == QuizKind.Set)
                await studySets.SetGeneratedAsync(quizId, ct);
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
