using Microsoft.AspNetCore.Identity;

namespace StudyJit.Api.Data;

public class AppUser : IdentityUser
{
    public string Name { get; set; } = "";
    public string? Bio { get; set; }

    /// <summary>Admin or SuperAdmin for the admin site (see Admin/AdminRoles.cs); null for everyone else.</summary>
    public string? AdminRole { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

public class RefreshToken
{
    public long Id { get; set; }
    public string UserId { get; set; } = "";
    public string TokenHash { get; set; } = "";
    /// <summary>Every token rotated from one sign-in shares this, so a replayed token can revoke the whole session.</summary>
    public Guid FamilyId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}

/// <summary>What a folder holds: quizzes (the learning space) or files.</summary>
public static class FolderContext
{
    public const string Quizzes = "quizzes";
    public const string Files = "files";

    public static bool IsValid(string? context) => context is Quizzes or Files;
}

public class Folder
{
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public int? ParentId { get; set; }
    public string Context { get; set; } = FolderContext.Quizzes;
    /// <summary>The course a files folder is in (e.g. "Week 3"); course folders are flat.</summary>
    public int? CourseId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>A course the user takes: it holds that course's study sets and files.</summary>
public class Course
{
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    /// <summary>The course code, e.g. "BIO 101"; may be empty.</summary>
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>When it's taken, e.g. "Spring 2025"; may be empty.</summary>
    public string Term { get; set; } = "";
    /// <summary>A colour key the web app picks the course's colour by.</summary>
    public string Color { get; set; } = "blue";
    public DateTimeOffset CreatedAt { get; set; }
}

public class StoredFile
{
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public int? FolderId { get; set; }
    public int? CourseId { get; set; }
    public string Name { get; set; } = "";
    /// <summary>Where it is on disk, under Storage:Root.</summary>
    public string Path { get; set; } = "";
    public long Size { get; set; }
    public string? MimeType { get; set; }
    public DateTimeOffset UploadedAt { get; set; }
}

public static class GenerationStatus
{
    public const string NeverGenerated = "never_generated";
    public const string Queued = "queued";
    public const string Pending = "pending";
    public const string Success = "success";
    public const string Failed = "failed";
}

/// <summary>What a quiz is: a study set (usually one per course folder) or an exam built from study sets.</summary>
public static class QuizKind
{
    public const string Set = "set";
    public const string Exam = "exam";
}

public class Quiz
{
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    /// <summary>For a study set, the course folder it covers: that folder's files are always part of it.</summary>
    public int? FolderId { get; set; }
    public int? CourseId { get; set; }
    public string Kind { get; set; } = QuizKind.Set;
    /// <summary>For an exam, the study sets it covers.</summary>
    public List<int> SourceQuizIds { get; set; } = [];
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Prompt { get; set; }
    public int NumQuestions { get; set; } = 10;
    public string GenerationStatus { get; set; } = Data.GenerationStatus.NeverGenerated;
    /// <summary>Place in the generation queue while queued (1 = next).</summary>
    public int? QueueNumber { get; set; }
    public decimal? LastScore { get; set; }
    /// <summary>A short study guide of the material, written with the questions.</summary>
    public string? Summary { get; set; }
    /// <summary>A condensed, printable one-page version of the material, written with the questions.</summary>
    public string? CheatSheet { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public List<QuizQuestion> Questions { get; set; } = [];
    /// <summary>Key terms of the material, for flashcards and matching.</summary>
    public List<QuizTerm> Terms { get; set; } = [];
    /// <summary>True-or-false statements, written for that format.</summary>
    public List<QuizStatement> Statements { get; set; } = [];
    /// <summary>Questions with short answers to type.</summary>
    public List<QuizShortAnswer> ShortAnswers { get; set; } = [];
}

public class QuizQuestion
{
    public int Id { get; set; }
    public int QuizId { get; set; }
    public string Question { get; set; } = "";
    public List<string> Options { get; set; } = [];
    /// <summary>The text of the right option.</summary>
    public string CorrectAnswer { get; set; } = "";
    /// <summary>Why the right option is right, shown after answering.</summary>
    public string Explanation { get; set; } = "";
}

public class QuizTerm
{
    public int Id { get; set; }
    public int QuizId { get; set; }
    public string Term { get; set; } = "";
    public string Definition { get; set; } = "";
}

/// <summary>A claim that's plainly true or false, for true-or-false practice.</summary>
public class QuizStatement
{
    public int Id { get; set; }
    public int QuizId { get; set; }
    public string Statement { get; set; } = "";
    public bool IsTrue { get; set; }
    /// <summary>Why it's true, or what's actually right when it's false.</summary>
    public string Explanation { get; set; } = "";
}

/// <summary>A question whose answer is a few words a student can type.</summary>
public class QuizShortAnswer
{
    public int Id { get; set; }
    public int QuizId { get; set; }
    public string Question { get; set; } = "";
    public string Answer { get; set; } = "";
    /// <summary>Other answers that count as right (synonyms, abbreviations, other notations).</summary>
    public List<string> Alternatives { get; set; } = [];
    public string Explanation { get; set; } = "";
}

/// <summary>A file a quiz is generated from.</summary>
public class QuizFile
{
    public int Id { get; set; }
    public int QuizId { get; set; }
    public int FileId { get; set; }
    public DateTimeOffset LinkedAt { get; set; }
}

/// <summary>A setting admins change while the server runs (see Admin/ServerSettings.cs).</summary>
public class ServerSetting
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
    public DateTimeOffset UpdatedAt { get; set; }
}
