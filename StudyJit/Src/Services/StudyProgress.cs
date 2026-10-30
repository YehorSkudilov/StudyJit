using StudyJit.Models;
using StudyJit.Services.Offline;

namespace StudyJit.Services;

/// <summary>
/// How studying goes, saved on the device first (<see cref="LocalStore"/>) and sent to the server by
/// <see cref="SyncService"/> when it can be reached, so it works offline and follows the account to other devices and the
/// website: each answer (so later sessions favour what's new or was missed), personal bests, and scores.
/// </summary>
public class StudyProgress(LocalStore store, StudyData data, SyncService sync)
{
    /// <summary>How many questions one practice session takes from the bank.</summary>
    public const int SessionSize = 15;

    /// <summary>Remembers how a question went.</summary>
    public void Record(int quizId, string key, bool correct)
    {
        var now = DateTimeOffset.UtcNow;
        store.RecordAnswer(quizId, key, correct, now);
        store.Enqueue(SyncService.AnswerKind, new StudyAnswerItem(Guid.NewGuid(), quizId, key, correct, now));
        sync.Schedule(TimeSpan.FromSeconds(5));
    }

    /// <summary>
    /// Picks a session's items from a bank: never-seen ones first, then ones answered wrong more than right, then the
    /// longest since seen, with a little randomness so no two sessions are alike. Returned in random order.
    /// </summary>
    public List<T> PickFrom<T>(int quizId, IReadOnlyList<T> items, Func<T, string> keyOf, int size)
    {
        if (items.Count <= size)
            return StudyItems.Shuffle(items);
        var history = store.History(quizId);
        var now = DateTimeOffset.UtcNow;
        double Score(T item)
        {
            if (history.GetValueOrDefault(keyOf(item)) is not { } h)
                return 1000 + Random.Shared.NextDouble() * 100;
            var struggling = Math.Max(0, h.Wrong - h.Right) * 50;
            var daysSince = (now - h.Seen).TotalDays;
            return struggling + Math.Min(daysSince, 30) * 5 + Random.Shared.NextDouble() * 40;
        }
        return StudyItems.Shuffle(items.OrderByDescending(Score).Take(size));
    }

    public List<Question> PickQuestions(StudyQuiz quiz, int size) => PickFrom(quiz.Id, quiz.Questions, StudyItems.QuestionKey, size);

    // ---------- Personal bests ----------

    public double? Best(string key) => store.Best(key);

    /// <summary>Saves the value if it beats the stored one; lower is better for times. Returns whether it's a new best.</summary>
    public bool RecordBest(string key, double value, bool lowerIsBetter)
    {
        if (!store.SetBestIfBetter(key, value, lowerIsBetter))
            return false;
        store.Enqueue(SyncService.BestKind, new StudyBestItem(key, value, lowerIsBetter));
        sync.Schedule(TimeSpan.FromSeconds(2));
        return true;
    }

    // ---------- Scores ----------

    /// <summary>Records a percentage as the set's last score: shown at once, sent when the server can be reached.</summary>
    public void SaveScore(int quizId, double percent)
    {
        data.SetLastScore(quizId, percent);
        store.Enqueue(SyncService.ScoreKind, new ScoreItem(quizId, Math.Round(percent, 2)));
        sync.Schedule(TimeSpan.FromSeconds(1));
    }
}
