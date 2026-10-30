using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>Write: recall without options; short questions written for typing, and key terms named from their definitions.</summary>
public class WriteMode : ModeView
{
    List<StudyItem> _items = [];
    readonly List<ReviewRow> _review = [];
    int _index;

    protected override void Start() => Begin(Build());

    List<StudyItem> Build()
    {
        var answers = Progress.PickFrom(Quiz.Id, Quiz.ShortAnswers, StudyItems.ShortAnswerKey, 15).Select(StudyItems.Written).ToList();
        var terms = StudyItems.Shuffle(Quiz.Terms.Select(StudyItems.WrittenFromTerm)).Take(Math.Max(10, 25 - answers.Count));
        return StudyItems.Shuffle(answers.Concat(terms));
    }

    void Begin(List<StudyItem> items)
    {
        _items = StudyItems.Shuffle(items);
        _review.Clear();
        _index = 0;
        Next();
    }

    void Next()
    {
        if (_index >= _items.Count)
        {
            Finish();
            return;
        }
        var item = _items[_index];
        Host.SetProgress((double)_index / _items.Count);
        Host.SetStat($"{_review.Count(r => r.Correct)} right");
        var card = new ItemCard(item, feedback: true);
        card.Answered += (_, right) =>
        {
            if (item.HistoryKey != null)
                Progress.Record(Quiz.Id, item.HistoryKey, right);
            _review.Add(ResultsView.Row(item, card.Given));
        };
        card.Overridden += (_, _) =>
        {
            _review[^1] = _review[^1] with { Correct = true };
            if (item.HistoryKey != null)
                Progress.Record(Quiz.Id, item.HistoryKey, true);
        };
        card.Continued += (_, _) =>
        {
            _index++;
            Next();
        };
        Show(card);
        card.FocusEntry();
    }

    void Finish()
    {
        Host.SetProgress(1);
        var missed = _items.Where((_, i) => !_review[i].Correct).ToList();
        var actions = new List<(string, Action, bool)>();
        if (missed.Count > 0)
            actions.Add(($"Write the {missed.Count} I missed again", () => Begin(missed), true));
        actions.Add(("New round", () => Begin(Build()), missed.Count == 0));
        actions.Add(("Back to study modes", () => _ = Host.ExitAsync(), false));
        Show(new ResultsView(_review.Count(r => r.Correct), _items.Count, _review, actions));
    }
}
