using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using StudyJit.Models;

namespace StudyJit.Services;

public enum ItemKind { Choice, TrueFalse, Written }

/// <summary>
/// One thing to answer in a study mode (the website's lib/study.ts Item). <see cref="HistoryKey"/> keys its history
/// (see <see cref="StudyProgress"/>); key terms have none. A true-or-false answer is "True" or "False".
/// </summary>
public record StudyItem(ItemKind Kind, string Key, string Prompt, string Answer)
{
    public string? HistoryKey { get; init; }
    public IReadOnlyList<string> Options { get; init; } = [];
    /// <summary>The statement to judge, for true or false (the prompt is then "True or false?").</summary>
    public string? Statement { get; init; }
    public IReadOnlyList<string> Alternatives { get; init; } = [];
    public string? Explanation { get; init; }
    /// <summary>A small heading above the prompt, e.g. "Write the term".</summary>
    public string? Label { get; init; }
}

/// <summary>Making study items from a set's content, and checking answers to them.</summary>
public static partial class StudyItems
{
    public static string QuestionKey(Question q) => $"q{q.Id}";
    public static string StatementKey(Statement s) => $"s{s.Id}";
    public static string ShortAnswerKey(ShortAnswer s) => $"a{s.Id}";

    public static StudyItem Choice(Question q) =>
        new(ItemKind.Choice, QuestionKey(q), q.Text, q.Correct) { HistoryKey = QuestionKey(q), Options = Shuffle(q.Options), Explanation = q.Explanation };

    /// <summary>A statement written to be judged true or false.</summary>
    public static StudyItem TrueFalse(Statement s) =>
        new(ItemKind.TrueFalse, StatementKey(s), "True or false?", s.IsTrue ? "True" : "False")
        {
            HistoryKey = StatementKey(s), Statement = s.Text, Explanation = s.Explanation,
        };

    /// <summary>A question answered by typing a few words; its alternatives count too.</summary>
    public static StudyItem Written(ShortAnswer s) =>
        new(ItemKind.Written, ShortAnswerKey(s), s.Question, s.Answer) { HistoryKey = ShortAnswerKey(s), Alternatives = s.Alternatives, Explanation = s.Explanation };

    /// <summary>A key term to type from its definition.</summary>
    public static StudyItem WrittenFromTerm(Term t, int i) => new(ItemKind.Written, $"w{i}", t.Definition, t.Name) { Label = "Write the term" };

    /// <summary>A key term to pick from four, by its definition.</summary>
    public static StudyItem ChoiceFromTerm(Term t, int i, IReadOnlyList<Term> all) =>
        new(ItemKind.Choice, $"tm{i}", t.Definition, t.Name)
        {
            Options = Shuffle([t.Name, .. Sample(all.Where(o => o.Name != t.Name).ToList(), 3).Select(o => o.Name)]),
            Label = "Pick the term",
        };

    public static bool IsRight(StudyItem item, string? given)
    {
        if (string.IsNullOrEmpty(given))
            return false;
        return item.Kind switch
        {
            ItemKind.Written => item.Alternatives.Prepend(item.Answer).Any(a => CloseEnough(given, a)),
            _ => string.Equals(given.Trim(), item.Answer.Trim(), StringComparison.OrdinalIgnoreCase),
        };
    }

    // ---------- Comparing typed answers ----------

    public static string Normalize(string text)
    {
        var decomposed = text.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var plain = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                plain.Append(char.IsLetterOrDigit(c) || char.IsWhiteSpace(c) ? c : ' ');
        var withoutArticles = Articles().Replace(plain.ToString(), " ");
        return Spaces().Replace(withoutArticles, " ").Trim();
    }

    [GeneratedRegex(@"\b(the|a|an)\b")]
    private static partial Regex Articles();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();

    static int Distance(string a, string b)
    {
        var row = Enumerable.Range(0, b.Length + 1).ToArray();
        for (var i = 1; i <= a.Length; i++)
        {
            var prev = row[0];
            row[0] = i;
            for (var j = 1; j <= b.Length; j++)
            {
                var temp = row[j];
                row[j] = Math.Min(Math.Min(row[j] + 1, row[j - 1] + 1), prev + (a[i - 1] == b[j - 1] ? 0 : 1));
                prev = temp;
            }
        }
        return row[b.Length];
    }

    /// <summary>Typed answers forgive case, accents, punctuation, articles and a small typo or two.</summary>
    public static bool CloseEnough(string given, string expected)
    {
        var g = Normalize(given);
        var e = Normalize(expected);
        if (g.Length == 0)
            return false;
        if (g == e)
            return true;
        var allowed = e.Length <= 4 ? 0 : e.Length <= 8 ? 1 : (int)Math.Floor(e.Length * 0.15);
        return Distance(g, e) <= allowed;
    }

    // ---------- Randomness ----------

    public static List<T> Shuffle<T>(IEnumerable<T> items)
    {
        var copy = items.ToList();
        for (var i = copy.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (copy[i], copy[j]) = (copy[j], copy[i]);
        }
        return copy;
    }

    public static List<T> Sample<T>(IEnumerable<T> items, int count) => Shuffle(items).Take(count).ToList();

    public static string FormatTime(TimeSpan time)
    {
        var total = Math.Max(0, time.TotalSeconds);
        return $"{(int)(total / 60)}:{total % 60:00.0}";
    }
}
