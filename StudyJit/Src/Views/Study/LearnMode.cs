using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>
/// Learn: adaptive rounds. Each item has to be answered right twice (the second time in a harder form where it has one)
/// to be mastered; misses come back in a later round, and nothing is finished until everything is mastered.
/// </summary>
public class LearnMode : ModeView
{
    const int Round = 7, Questions = 14, ShortAnswers = 8, Terms = 10;

    /// <summary>Something to master, in its easy and hard forms.</summary>
    record Learnable(string Id, Func<StudyItem> Easy, Func<StudyItem> Hard);

    List<Learnable> _all = [];
    readonly Dictionary<string, int> _level = [];
    List<(Learnable L, StudyItem Item)> _round = [];
    int _index, _roundCorrect;

    protected override void Start() => Restart();

    List<Learnable> Build()
    {
        var fromQuestions = Progress.PickQuestions(Quiz, Questions)
            .Select(q => new Learnable($"q{q.Id}", () => StudyItems.Choice(q), () => StudyItems.Choice(q)));
        var fromShort = Progress.PickFrom(Quiz.Id, Quiz.ShortAnswers, StudyItems.ShortAnswerKey, ShortAnswers)
            .Select(s => new Learnable($"a{s.Id}", () => StudyItems.Written(s), () => StudyItems.Written(s)));
        var terms = Quiz.Terms;
        var fromTerms = terms.Count >= 4
            ? StudyItems.Sample(terms, Terms).Select((t, i) => new Learnable($"t{i}", () => StudyItems.ChoiceFromTerm(t, i, terms), () => StudyItems.WrittenFromTerm(t, i)))
            : [];
        return StudyItems.Shuffle(fromQuestions.Concat(fromShort).Concat(fromTerms));
    }

    int Level(Learnable l) => _level.GetValueOrDefault(l.Id);

    int Mastered => _all.Count(l => Level(l) >= 2);

    void Restart()
    {
        _all = Build();
        _level.Clear();
        StartRound();
    }

    /// <summary>The next round: the least-known items first, each asked at its level.</summary>
    void StartRound()
    {
        _round = StudyItems.Shuffle(_all.Where(l => Level(l) < 2)).OrderBy(Level).Take(Round)
            .Select(l => (l, Level(l) == 0 ? l.Easy() : l.Hard())).ToList();
        _index = 0;
        _roundCorrect = 0;
        Next();
    }

    void UpdateStats()
    {
        Host.SetProgress(_all.Count == 0 ? 0 : _all.Sum(l => (double)Math.Min(2, Level(l))) / (_all.Count * 2));
        Host.SetStat($"{Mastered}/{_all.Count} mastered");
    }

    void Next()
    {
        UpdateStats();
        if (_index >= _round.Count)
        {
            Between();
            return;
        }
        var (l, item) = _round[_index];
        var card = new ItemCard(item, feedback: true);
        card.Answered += (_, right) =>
        {
            if (item.HistoryKey != null)
                Progress.Record(Quiz.Id, item.HistoryKey, right);
            _level[l.Id] = right ? Math.Min(2, Level(l) + 1) : Math.Max(0, Level(l) - 1);
            if (right)
                _roundCorrect++;
            UpdateStats();
        };
        card.Overridden += (_, _) =>
        {
            // Undo the miss and count it as right.
            _level[l.Id] = Math.Min(2, Level(l) + 2);
            _roundCorrect++;
            UpdateStats();
        };
        card.Continued += (_, _) =>
        {
            _index++;
            Next();
        };
        Show(card);
        card.FocusEntry();
    }

    void Between()
    {
        var finished = Mastered == _all.Count;
        var stack = new VerticalStackLayout { Spacing = 14 };
        stack.Children.Add(Ui.Icon(finished ? "emoji_events" : "psychology", 56, finished ? "Warning" : "Accent"));
        stack.Children.Add(Ui.Text(finished ? "All mastered!" : $"Round done", 24, bold: true, align: TextAlignment.Center));
        stack.Children.Add(Ui.Caption(finished
            ? $"You've mastered all {_all.Count} items in this batch. Learn another batch from the set, or try a Test to prove it."
            : $"{_roundCorrect} of {_round.Count} right this round. Keep going: misses come back until you've got them.", TextAlignment.Center));

        var counts = new Grid { ColumnDefinitions = [new(GridLength.Star), new(GridLength.Star), new(GridLength.Star)], ColumnSpacing = 10 };
        (string Label, int Value, string Color)[] parts =
        [
            ("Mastered", Mastered, "Success"),
            ("Learning", _all.Count(l => Level(l) == 1), "Warning"),
            ("Not yet", _all.Count(l => Level(l) == 0), "TextSecondary"),
        ];
        for (var i = 0; i < parts.Length; i++)
            counts.Add(Ui.Card(Ui.Stack(2, Ui.Text(parts[i].Value.ToString(), 22, parts[i].Color, true, TextAlignment.Center),
                Ui.Caption(parts[i].Label, TextAlignment.Center)), 12), i);
        stack.Children.Add(counts);

        if (finished)
        {
            stack.Children.Add(Ui.Primary("Learn another batch", Restart));
            stack.Children.Add(Ui.Secondary("Back to study modes", () => _ = Host.ExitAsync()));
        }
        else
            stack.Children.Add(Ui.Primary("Next round", StartRound));
        Show(stack);
    }
}
