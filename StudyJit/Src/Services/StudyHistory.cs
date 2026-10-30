using System.Text.Json;
using StudyJit.Models;

namespace StudyJit.Services;

/// <summary>
/// How each question went on this device (as the website keeps it per browser), so later sessions favour what's new or
/// was missed; and personal bests (Match times, True or False scores).
/// </summary>
public static class StudyHistory
{
    /// <summary>How many questions one practice session takes from the bank.</summary>
    public const int SessionSize = 15;

    record Entry(long Seen, int Right, int Wrong);

    static string HistoryKey(int quizId) => $"studyjit.history.{quizId}";

    static Dictionary<string, Entry> Read(int quizId)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, Entry>>(Preferences.Default.Get(HistoryKey(quizId), "{}")) ?? [];
        }
        catch (Exception)
        {
            return [];
        }
    }

    /// <summary>Remembers how a question went.</summary>
    public static void Record(int quizId, string key, bool correct)
    {
        var history = Read(quizId);
        var entry = history.GetValueOrDefault(key) ?? new(0, 0, 0);
        history[key] = new(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), entry.Right + (correct ? 1 : 0), entry.Wrong + (correct ? 0 : 1));
        Preferences.Default.Set(HistoryKey(quizId), JsonSerializer.Serialize(history));
    }

    /// <summary>
    /// Picks a session's items from a bank: never-seen ones first, then ones answered wrong more than right, then the
    /// longest since seen, with a little randomness so no two sessions are alike. Returned in random order.
    /// </summary>
    public static List<T> PickFrom<T>(int quizId, IReadOnlyList<T> items, Func<T, string> keyOf, int size)
    {
        if (items.Count <= size)
            return StudyItems.Shuffle(items);
        var history = Read(quizId);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        double Score(T item)
        {
            if (history.GetValueOrDefault(keyOf(item)) is not { } h)
                return 1000 + Random.Shared.NextDouble() * 100;
            var struggling = Math.Max(0, h.Wrong - h.Right) * 50;
            var daysSince = (now - h.Seen) / 86_400_000.0;
            return struggling + Math.Min(daysSince, 30) * 5 + Random.Shared.NextDouble() * 40;
        }
        return StudyItems.Shuffle(items.OrderByDescending(Score).Take(size));
    }

    public static List<Question> PickQuestions(StudyQuiz quiz, int size) => PickFrom(quiz.Id, quiz.Questions, StudyItems.QuestionKey, size);

    // ---------- Personal bests ----------

    public static double? Best(string key) =>
        Preferences.Default.ContainsKey($"studyjit.best.{key}") ? Preferences.Default.Get($"studyjit.best.{key}", 0.0) : null;

    /// <summary>Saves the value if it beats the stored one; lower is better for times. Returns whether it's a new best.</summary>
    public static bool RecordBest(string key, double value, bool lowerIsBetter)
    {
        var best = Best(key);
        var better = best == null || (lowerIsBetter ? value < best : value > best);
        if (better)
            Preferences.Default.Set($"studyjit.best.{key}", value);
        return better;
    }
}
