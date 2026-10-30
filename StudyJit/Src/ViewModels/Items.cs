using System.Windows.Input;
using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.ViewModels;

/// <summary>The courses and every study set, as Home and Library show them.</summary>
public record CoursesAndSets(List<Course> Courses, List<QuizSummary> Quizzes)
{
    public static CoursesAndSets? Cached(StudyJit.Services.Offline.StudyData data) =>
        data.CachedCourses() is { } courses && data.CachedQuizzes(null) is { } quizzes ? new(courses, quizzes) : null;

    public static async Task<CoursesAndSets> FetchAsync(StudyJit.Services.Offline.StudyData data)
    {
        var courses = data.CoursesAsync();
        var quizzes = await data.QuizzesAsync(null);
        return new(await courses, quizzes);
    }
}

/// <summary>A course as its card shows it: the colour, the title, what's in it.</summary>
public class CourseItem(Course course, ICommand open)
{
    public Course Course { get; } = course;
    public ICommand OpenCommand { get; } = open;

    public string Title => Course.Name;
    public string Code => Course.Code.Length > 0 ? Course.Code : Initials(Course.Name);
    public Brush Gradient => CourseColors.Gradient(Course.Color);
    public Color Tint => CourseColors.Of(Course.Color).Text;

    public string Details
    {
        get
        {
            var parts = new List<string>();
            if (Course.Term.Length > 0)
                parts.Add(Course.Term);
            parts.Add(Course.QuizCount == 1 ? "1 study set" : $"{Course.QuizCount} study sets");
            parts.Add(Course.FileCount == 1 ? "1 file" : $"{Course.FileCount} files");
            return string.Join(" · ", parts);
        }
    }

    public bool HasScore => Course.AverageScore != null;
    public string Score => Course.AverageScore is { } s ? $"{s:0}%" : "";
    public bool IsGenerating => Course.GeneratingCount > 0;
    public string Generating => Course.GeneratingCount == 1 ? "1 generating" : $"{Course.GeneratingCount} generating";

    static string Initials(string name) =>
        string.Concat(name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2).Select(w => char.ToUpperInvariant(w[0])));
}

/// <summary>A study set or exam as a row shows it: its name, where it's at, the last score.</summary>
public class QuizItem(QuizSummary quiz, string? courseTitle, string? courseColor, ICommand open)
{
    public QuizSummary Quiz { get; } = quiz;
    public ICommand OpenCommand { get; } = open;

    public string Name => Quiz.Name;
    public string? CourseTitle { get; } = courseTitle;
    public bool HasCourse => CourseTitle != null;
    public Brush Gradient => CourseColors.Gradient(courseColor);
    public string Glyph => Quiz.IsExam ? "quiz" : "folder_open";

    public bool IsReady => Quiz.GenerationStatus == GenerationStatus.Success;
    public bool IsRunning => GenerationStatus.IsRunning(Quiz.GenerationStatus);
    public bool IsFailed => Quiz.GenerationStatus == GenerationStatus.Failed;
    public double ProgressValue => (Quiz.Progress?.Percent ?? 0) / 100.0;

    public string Status => Quiz.GenerationStatus switch
    {
        GenerationStatus.Success => Quiz.Questions.Count == 1 ? "1 question" : $"{Quiz.Questions.Count} questions",
        GenerationStatus.Queued => "Waiting to generate…",
        GenerationStatus.Pending => Quiz.Progress is { } p ? $"Generating · {p.Percent}%" : "Generating…",
        GenerationStatus.Failed => "Generation failed",
        _ => "Not generated yet",
    };

    public Color StatusColor => Quiz.GenerationStatus switch
    {
        GenerationStatus.Failed => (Color)Application.Current!.Resources["Danger"],
        GenerationStatus.Queued or GenerationStatus.Pending => (Color)Application.Current!.Resources["Accent2"],
        _ => (Color)Application.Current!.Resources["TextSecondary"],
    };

    public bool HasScore => Quiz.LastScore != null;
    public string Score => Quiz.LastScore is { } s ? $"{s:0}%" : "";
    public Color ScoreColor => Quiz.LastScore switch
    {
        >= 80 => (Color)Application.Current!.Resources["Success"],
        >= 50 => (Color)Application.Current!.Resources["Warning"],
        _ => (Color)Application.Current!.Resources["Danger"],
    };
}

/// <summary>A course file, under its folder on the Files tab.</summary>
public class FileItem(CourseFile file, ICommand menu)
{
    public CourseFile File { get; } = file;
    public ICommand MenuCommand { get; } = menu;

    public string Name => File.Name;
    public string Details => $"{FormatBytes(File.Size)} · {File.UploadedAt.ToLocalTime():d MMM yyyy}";
    public string Glyph => File.MimeType switch
    {
        { } m when m.StartsWith("video/") || m.StartsWith("audio/") => "smart_display",
        { } m when m.StartsWith("image/") => "image",
        "application/pdf" => "picture_as_pdf",
        _ => "description",
    };

    public static string FormatBytes(long size) => size switch
    {
        < 1024 => $"{size} B",
        < 1024 * 1024 => $"{size / 1024.0:0} KB",
        < 1024L * 1024 * 1024 => $"{size / (1024.0 * 1024):0.0} MB",
        _ => $"{size / (1024.0 * 1024 * 1024):0.00} GB",
    };
}

/// <summary>A folder of course files (each folder with files gets its own study set), or the files in no folder.</summary>
public class FolderGroup(string name, int? folderId, IReadOnlyList<FileItem> files, ICommand? menu)
{
    public string Name { get; } = name;
    public int? FolderId { get; } = folderId;
    public IReadOnlyList<FileItem> Files { get; } = files;
    public ICommand? MenuCommand { get; } = menu;
    public bool HasMenu => MenuCommand != null;
    public string Count => Files.Count == 1 ? "1 file" : $"{Files.Count} files";
    public bool IsEmpty => Files.Count == 0;
}

/// <summary>A study mode's tile on a set's page: its colours, and why it can't run yet if it can't.</summary>
public class ModeItem(ModeInfo info, string? unavailable, ICommand open)
{
    public ModeInfo Info { get; } = info;
    public ICommand OpenCommand { get; } = open;
    public string Title => Info.Title;
    public string Blurb => unavailable ?? Info.Blurb;
    public string Glyph => Info.Glyph;
    public bool IsAvailable => unavailable == null;
    public double TileOpacity => IsAvailable ? 1 : 0.45;
    public Brush Gradient => new LinearGradientBrush([new GradientStop(Info.From, 0), new GradientStop(Info.To, 1)], new Point(0, 0), new Point(1, 1));
}

/// <summary>A study set to tick for a new exam.</summary>
public partial class PickItem(QuizSummary quiz) : CommunityToolkit.Mvvm.ComponentModel.ObservableObject
{
    public QuizSummary Quiz { get; } = quiz;
    public string Name => Quiz.Name;

    [CommunityToolkit.Mvvm.ComponentModel.ObservableProperty]
    public partial bool IsPicked { get; set; } = true;
}
