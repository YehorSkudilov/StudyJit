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
    public DateTimeOffset CreatedAt { get; set; }
}

public class StoredFile
{
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public int? FolderId { get; set; }
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

public class Quiz
{
    public int Id { get; set; }
    public string UserId { get; set; } = "";
    public int? FolderId { get; set; }
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
    public DateTimeOffset CreatedAt { get; set; }

    public List<QuizQuestion> Questions { get; set; } = [];
    /// <summary>Key terms of the material, for flashcards and matching.</summary>
    public List<QuizTerm> Terms { get; set; } = [];
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
