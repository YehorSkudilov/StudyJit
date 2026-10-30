using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>Practice: a session of questions from the bank (new and missed first), one at a time with instant feedback.</summary>
public class PracticeMode : ModeView
{
    List<StudyItem> _items = [];
    readonly List<ReviewRow> _review = [];
    int _index;
    bool _retrying;

    protected override void Start() => Begin(Progress.PickQuestions(Quiz, StudyProgress.SessionSize), false);

    void Begin(IEnumerable<Question> questions, bool retrying)
    {
        _items = questions.Select(StudyItems.Choice).ToList();
        _review.Clear();
        _index = 0;
        _retrying = retrying;
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
        Host.SetStat($"{_index + 1} / {_items.Count}");
        var card = new ItemCard(item, feedback: true);
        card.Answered += (_, right) =>
        {
            Progress.Record(Quiz.Id, item.HistoryKey!, right);
            _review.Add(ResultsView.Row(item, card.Given));
        };
        card.Continued += (_, _) =>
        {
            _index++;
            Next();
        };
        Show(card);
    }

    void Finish()
    {
        Host.SetProgress(1);
        var right = _review.Count(r => r.Correct);
        if (!_retrying)
            Progress.SaveScore(Quiz.Id, 100.0 * right / _items.Count);
        var missed = _items.Where((item, i) => !_review[i].Correct).Select(i => Quiz.Questions.First(q => StudyItems.QuestionKey(q) == i.Key)).ToList();
        var actions = new List<(string, Action, bool)>();
        if (missed.Count > 0)
            actions.Add(($"Practise the {missed.Count} I missed", () => Begin(StudyItems.Shuffle(missed), true), true));
        actions.Add(("New session", () => Begin(Progress.PickQuestions(Quiz, StudyProgress.SessionSize), false), missed.Count == 0));
        actions.Add(("Back to study modes", () => _ = Host.ExitAsync(), false));
        Show(new ResultsView(right, _items.Count, _review, actions, _retrying ? "A retry of the ones you missed: your score stays as it was." : null));
    }
}
