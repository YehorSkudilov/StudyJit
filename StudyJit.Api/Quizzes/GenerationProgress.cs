using System.Collections.Concurrent;
using System.Text.Json.Serialization;

namespace StudyJit.Api.Quizzes;

/// <summary>
/// How far a generation has got, for the web app's progress bar. Stages run in this order: reading (uploading the
/// files), indexing (making them searchable), thinking (before the AI writes anything), then one stage per part it
/// writes, in the schema's order, and saving.
/// </summary>
public record GenerationProgressDto(
    string Stage,
    int Percent,
    [property: JsonPropertyName("files_done")] int FilesDone,
    [property: JsonPropertyName("files_total")] int FilesTotal,
    int Questions,
    int Statements,
    [property: JsonPropertyName("short_answers")] int ShortAnswers,
    [property: JsonPropertyName("written_answers")] int WrittenAnswers,
    int Terms,
    [property: JsonPropertyName("cheat_sheet_words")] int CheatSheetWords,
    [property: JsonPropertyName("started_at")] DateTimeOffset StartedAt);

/// <summary>Live progress of the generations running now, kept in memory (it only matters while one runs).</summary>
public class GenerationProgress(TimeProvider clock)
{
    readonly ConcurrentDictionary<int, GenerationProgressDto> _running = new();

    /// <summary>The written parts, in the order the AI writes them, with their share of the bar and a typical size.</summary>
    static readonly (string Stage, int Weight, double Typical)[] Parts =
    [
        ("questions", 28, 35), ("true_false", 7, 25), ("short_answers", 6, 18), ("written_answers", 8, 8),
        ("summary", 4, 300), ("terms", 6, 25), ("cheat_sheet", 17, 1200),
    ];

    const int WritingStart = 20, WritingEnd = 96;

    /// <summary>The progress now; time-based stages (thinking) move on between updates.</summary>
    public GenerationProgressDto? Get(int quizId) =>
        _running.TryGetValue(quizId, out var p) ? p with { Percent = Math.Max(p.Percent, Percent(p)) } : null;

    public void Start(int quizId) => _running[quizId] = new("reading", 1, 0, 0, 0, 0, 0, 0, 0, 0, clock.GetUtcNow());

    public void Finish(int quizId) => _running.TryRemove(quizId, out _);

    /// <summary>Applies a change and recomputes the percentage, which only ever goes up.</summary>
    public void Update(int quizId, Func<GenerationProgressDto, GenerationProgressDto> change)
    {
        if (!_running.TryGetValue(quizId, out var current))
            return;
        var next = change(current);
        _running[quizId] = next with { Percent = Math.Max(current.Percent, Percent(next)) };
    }

    int Percent(GenerationProgressDto p)
    {
        var part = Array.FindIndex(Parts, x => x.Stage == p.Stage);
        if (part >= 0)
        {
            var done = Parts.Take(part).Sum(x => x.Weight);
            var (_, weight, typical) = Parts[part];
            // Nobody knows how much the AI will write, so the current part creeps towards full as it grows.
            var fraction = 1 - Math.Exp(-SizeOf(p, p.Stage) / typical);
            var total = Parts.Sum(x => x.Weight);
            return WritingStart + (int)((done + weight * fraction) / total * (WritingEnd - WritingStart));
        }
        return p.Stage switch
        {
            "reading" => 2 + (p.FilesTotal == 0 ? 6 : 6 * p.FilesDone / p.FilesTotal),
            "indexing" => 10,
            // Reasoning before the first word: creep from 12% towards 20% over a couple of minutes.
            "thinking" => 12 + (int)(8 * (1 - Math.Exp(-(clock.GetUtcNow() - p.StartedAt).TotalSeconds / 90))),
            "saving" => 97,
            _ => 0,
        };
    }

    static double SizeOf(GenerationProgressDto p, string stage) => stage switch
    {
        "questions" => p.Questions,
        "true_false" => p.Statements,
        "short_answers" => p.ShortAnswers,
        "written_answers" => p.WrittenAnswers,
        "terms" => p.Terms,
        // The summary isn't counted as it streams; it's short, so it sits about half way until the terms start.
        "summary" => 200,
        "cheat_sheet" => p.CheatSheetWords,
        _ => 0,
    };
}
