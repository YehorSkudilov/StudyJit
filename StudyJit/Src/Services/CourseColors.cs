namespace StudyJit.Services;

/// <summary>Each course colour the API knows (CoursesController.Colors), as the website draws it: a gradient and a soft tint.</summary>
public static class CourseColors
{
    public record Look(Color From, Color To, Color Text);

    static readonly Dictionary<string, Look> Looks = new()
    {
        ["blue"] = new(Color.FromArgb("#2563EB"), Color.FromArgb("#38BDF8"), Color.FromArgb("#60A5FA")),
        ["violet"] = new(Color.FromArgb("#7C3AED"), Color.FromArgb("#E879F9"), Color.FromArgb("#A78BFA")),
        ["emerald"] = new(Color.FromArgb("#059669"), Color.FromArgb("#2DD4BF"), Color.FromArgb("#34D399")),
        ["amber"] = new(Color.FromArgb("#F59E0B"), Color.FromArgb("#FB923C"), Color.FromArgb("#FBBF24")),
        ["rose"] = new(Color.FromArgb("#E11D48"), Color.FromArgb("#F472B6"), Color.FromArgb("#FB7185")),
        ["cyan"] = new(Color.FromArgb("#0891B2"), Color.FromArgb("#5EEAD4"), Color.FromArgb("#22D3EE")),
        ["indigo"] = new(Color.FromArgb("#4F46E5"), Color.FromArgb("#60A5FA"), Color.FromArgb("#818CF8")),
        ["orange"] = new(Color.FromArgb("#EA580C"), Color.FromArgb("#FBBF24"), Color.FromArgb("#FB923C")),
    };

    public static IReadOnlyCollection<string> Names => Looks.Keys;

    public static Look Of(string? color) => color != null && Looks.TryGetValue(color, out var look) ? look : Looks["blue"];

    public static Brush Gradient(string? color)
    {
        var look = Of(color);
        return new LinearGradientBrush([new GradientStop(look.From, 0), new GradientStop(look.To, 1)], new Point(0, 0), new Point(1, 1));
    }
}
