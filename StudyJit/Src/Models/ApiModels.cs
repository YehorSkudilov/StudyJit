using System.Text.Json.Serialization;

namespace StudyJit.Models;

// What StudyJit.Api sends and takes, as its controllers declare it (camelCase, with the snake_case names it spells out).

public class AuthResponse
{
    public string UserId { get; set; } = "";
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string AccessToken { get; set; } = "";
    public DateTimeOffset AccessTokenExpiresAt { get; set; }
    public string RefreshToken { get; set; } = "";
}

public record AuthOptions(bool SignUpEnabled);

public record Profile(string Id, string Name, string Email, string? Bio);

public record UpdateProfileRequest(string? Name, string? Email, string? Bio, string? CurrentPassword, string? NewPassword);

public record ErrorBody(string? Error, string? Title);

public class Course
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Term { get; set; } = "";
    public string Color { get; set; } = "blue";
    [JsonPropertyName("quiz_count")] public int QuizCount { get; set; }
    [JsonPropertyName("ready_count")] public int ReadyCount { get; set; }
    [JsonPropertyName("generating_count")] public int GeneratingCount { get; set; }
    [JsonPropertyName("file_count")] public int FileCount { get; set; }
    [JsonPropertyName("average_score")] public decimal? AverageScore { get; set; }
    [JsonPropertyName("created_at")] public DateTimeOffset CreatedAt { get; set; }

    /// <summary>"CS 101 · Intro to programming", or just the name without a code.</summary>
    public string Title => Code.Length > 0 ? $"{Code} · {Name}" : Name;
}

/// <summary>A course to create, or the fields to change (null ones stay as they are).</summary>
public record CourseDraft(string? Code, string? Name, string? Term, string? Color = null);

public class GenerationProgressInfo
{
    public string Stage { get; set; } = "";
    public int Percent { get; set; }
    [JsonPropertyName("files_done")] public int FilesDone { get; set; }
    [JsonPropertyName("files_total")] public int FilesTotal { get; set; }
    public int Questions { get; set; }
    public int Terms { get; set; }
}

/// <summary>A study set (a folder's, made automatically) or an exam (built from chosen study sets), as lists show it.</summary>
public class QuizSummary
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    [JsonPropertyName("generation_status")] public string GenerationStatus { get; set; } = "";
    [JsonPropertyName("num_questions")] public int NumQuestions { get; set; }
    [JsonPropertyName("course_id")] public int? CourseId { get; set; }
    [JsonPropertyName("folder_id")] public int? FolderId { get; set; }
    [JsonPropertyName("last_score")] public decimal? LastScore { get; set; }
    public List<Question> Questions { get; set; } = [];
    public string Kind { get; set; } = "set";
    [JsonPropertyName("source_ids")] public List<int> SourceIds { get; set; } = [];
    public GenerationProgressInfo? Progress { get; set; }

    public bool IsExam => Kind == "exam";
}

public static class GenerationStatus
{
    public const string NeverGenerated = "never_generated";
    public const string Queued = "queued";
    public const string Pending = "pending";
    public const string Success = "success";
    public const string Failed = "failed";

    public static bool IsRunning(string status) => status is Queued or Pending;
}

public class Question
{
    public int Id { get; set; }
    [JsonPropertyName("question")] public string Text { get; set; } = "";
    public List<string> Options { get; set; } = [];
    public string Correct { get; set; } = "";
    public string? Explanation { get; set; }
}

/// <summary>A key term and its definition (Flashcards, Match, Learn, Write, the glossary).</summary>
public record Term([property: JsonPropertyName("term")] string Name, string Definition);

public class Statement
{
    public int Id { get; set; }
    [JsonPropertyName("statement")] public string Text { get; set; } = "";
    [JsonPropertyName("is_true")] public bool IsTrue { get; set; }
    public string Explanation { get; set; } = "";
}

public class ShortAnswer
{
    public int Id { get; set; }
    public string Question { get; set; } = "";
    public string Answer { get; set; } = "";
    public List<string> Alternatives { get; set; } = [];
    public string Explanation { get; set; } = "";
}

/// <summary>An open question answered in sentences or code, marked by the AI against its key points.</summary>
public class WrittenAnswer
{
    public int Id { get; set; }
    public string Question { get; set; } = "";
    /// <summary>"explain" or "code".</summary>
    public string Kind { get; set; } = "explain";
    [JsonPropertyName("model_answer")] public string ModelAnswer { get; set; } = "";
    [JsonPropertyName("key_points")] public List<string> KeyPoints { get; set; } = [];
}

/// <summary>How the AI marked a written answer.</summary>
public class WrittenGrade
{
    public int Score { get; set; }
    /// <summary>"correct", "partial" or "incorrect".</summary>
    public string Verdict { get; set; } = "";
    public string Feedback { get; set; } = "";
    public List<string> Covered { get; set; } = [];
    public List<string> Missed { get; set; } = [];
}

/// <summary>Everything the study modes work from, as GET api/items/quizzes/get/{id} returns it.</summary>
public class StudyQuiz
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    [JsonPropertyName("generation_status")] public string GenerationStatus { get; set; } = "";
    [JsonPropertyName("last_score")] public decimal? LastScore { get; set; }
    [JsonPropertyName("queue_number")] public int? QueueNumber { get; set; }
    [JsonPropertyName("course_id")] public int? CourseId { get; set; }
    public string Kind { get; set; } = "set";
    public string? Summary { get; set; }
    [JsonPropertyName("cheat_sheet")] public string? CheatSheet { get; set; }
    public List<Question> Questions { get; set; } = [];
    public List<Term> Terms { get; set; } = [];
    public List<Statement> Statements { get; set; } = [];
    [JsonPropertyName("short_answers")] public List<ShortAnswer> ShortAnswers { get; set; } = [];
    [JsonPropertyName("written_answers")] public List<WrittenAnswer> WrittenAnswers { get; set; } = [];
    public GenerationProgressInfo? Progress { get; set; }
}

/// <summary>One answer given while studying, as POST api/study/progress takes it; its id makes a resend harmless.</summary>
public record StudyAnswerItem(
    Guid Id,
    [property: JsonPropertyName("quiz_id")] int QuizId,
    string Key,
    bool Correct,
    [property: JsonPropertyName("answered_at")] DateTimeOffset AnsweredAt);

/// <summary>A personal best ("match.12" a time in ms, "tf.12" points).</summary>
public record StudyBestItem(string Key, double Value, [property: JsonPropertyName("lower_is_better")] bool LowerIsBetter);

/// <summary>A score to record as a set's last score, waiting in the outbox.</summary>
public record ScoreItem([property: JsonPropertyName("quiz_id")] int QuizId, double Percent);

public record QuestionHistory([property: JsonPropertyName("quiz_id")] int QuizId, string Key, DateTimeOffset Seen, int Right, int Wrong);

/// <summary>GET api/study/progress: how every question has gone, and every best, across the account's devices.</summary>
public record StudyProgressResponse(List<QuestionHistory> History, List<StudyBestItem> Bests);

public class CourseFolder
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    [JsonPropertyName("file_count")] public int FileCount { get; set; }
}

public class FolderPlan
{
    public string Name { get; set; } = "";
    [JsonPropertyName("file_ids")] public List<int> FileIds { get; set; } = [];
}

public class CourseFile
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    [JsonPropertyName("course_id")] public int? CourseId { get; set; }
    [JsonPropertyName("folder_id")] public int? FolderId { get; set; }
    public long Size { get; set; }
    [JsonPropertyName("mime_type")] public string? MimeType { get; set; }
    [JsonPropertyName("uploaded_at")] public DateTimeOffset UploadedAt { get; set; }
}
