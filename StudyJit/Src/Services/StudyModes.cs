using StudyJit.Models;

namespace StudyJit.Services;

public enum StudyMode { Learn, Flashcards, Practice, Test, Match, TrueFalse, Write, Answers, Guide, CheatSheet }

/// <summary>A way of studying a set, as the website's lib/modes.ts lists them.</summary>
/// <param name="Unavailable">Why the mode can't run on a set, or null when it can.</param>
public record ModeInfo(StudyMode Mode, string Title, string Blurb, string Glyph, Color From, Color To, Func<StudyQuiz, string?> Unavailable);

public static class StudyModes
{
    static string? NeedsQuestions(StudyQuiz q) => q.Questions.Count > 0 ? null : "Generate questions first";

    public static readonly IReadOnlyList<ModeInfo> All =
    [
        new(StudyMode.Learn, "Learn", "Adaptive rounds that repeat what you miss until it's mastered", "psychology",
            Color.FromArgb("#8B5CF6"), Color.FromArgb("#D946EF"), NeedsQuestions),
        new(StudyMode.Flashcards, "Flashcards", "Flip and sort into “know it” and “still learning”", "style",
            Color.FromArgb("#0EA5E9"), Color.FromArgb("#22D3EE"), q => q.Terms.Count > 0 ? null : "Regenerate to get key terms"),
        new(StudyMode.Practice, "Practice", "One question at a time with instant feedback", "track_changes",
            Color.FromArgb("#10B981"), Color.FromArgb("#2DD4BF"), NeedsQuestions),
        new(StudyMode.Test, "Test", "Mixed question types, optional timer, graded at the end", "assignment_turned_in",
            Color.FromArgb("#2563EB"), Color.FromArgb("#6366F1"),
            q => q.Questions.Count > 0 || q.Statements.Count > 0 || q.ShortAnswers.Count > 0 ? null : "Generate questions first"),
        new(StudyMode.Match, "Match", "Pair terms with definitions against the clock", "extension",
            Color.FromArgb("#F59E0B"), Color.FromArgb("#F97316"), q => q.Terms.Count >= 2 ? null : "Regenerate to get key terms"),
        new(StudyMode.TrueFalse, "True or False", "A 60-second blitz: build a combo, beat your best", "bolt",
            Color.FromArgb("#F43F5E"), Color.FromArgb("#EC4899"), q => q.Statements.Count > 0 ? null : "Regenerate to get true-or-false statements"),
        new(StudyMode.Write, "Write", "Type answers from memory for the strongest recall", "edit",
            Color.FromArgb("#84CC16"), Color.FromArgb("#22C55E"),
            q => q.Terms.Count > 0 || q.ShortAnswers.Count > 0 ? null : "Regenerate to get written questions"),
        new(StudyMode.Answers, "Exam answers", "Explain concepts and write code; the AI marks it like an exam", "code",
            Color.FromArgb("#6366F1"), Color.FromArgb("#8B5CF6"), q => q.WrittenAnswers.Count > 0 ? null : "Regenerate to get exam-style questions"),
        new(StudyMode.Guide, "Study guide", "An AI summary and glossary of your material", "menu_book",
            Color.FromArgb("#475569"), Color.FromArgb("#94A3B8"),
            q => !string.IsNullOrWhiteSpace(q.Summary) || q.Terms.Count > 0 ? null : "Regenerate to get a study guide"),
        new(StudyMode.CheatSheet, "Cheat sheet", "One page of the essentials", "receipt_long",
            Color.FromArgb("#F59E0B"), Color.FromArgb("#FACC15"), q => !string.IsNullOrWhiteSpace(q.CheatSheet) ? null : "Regenerate to get a cheat sheet"),
    ];

    public static ModeInfo Of(StudyMode mode) => All.First(m => m.Mode == mode);
}
