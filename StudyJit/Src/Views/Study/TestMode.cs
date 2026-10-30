using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>Test: choose its size, question types and timing, answer it all, then see it graded.</summary>
public class TestMode : ModeView
{
    int _count;
    bool _timed;
    readonly HashSet<ItemKind> _chosen = [];
    List<StudyItem> _items = [];
    readonly List<ItemCard> _cards = [];
    DateTime _startedAt;
    IDispatcherTimer? _timer;
    bool _submitted;

    int PoolSize(ItemKind kind) => kind switch
    {
        ItemKind.Choice => Quiz.Questions.Count,
        ItemKind.TrueFalse => Quiz.Statements.Count,
        _ => Quiz.ShortAnswers.Count > 0 ? Quiz.ShortAnswers.Count : Quiz.Terms.Count,
    };

    int Max => Math.Max(1, _chosen.Sum(PoolSize));

    /// <summary>Each question type's own pool, new and missed first.</summary>
    List<StudyItem> Pool(ItemKind kind) => kind switch
    {
        ItemKind.Choice => StudyHistory.PickQuestions(Quiz, Quiz.Questions.Count).Select(StudyItems.Choice).ToList(),
        ItemKind.TrueFalse => StudyHistory.PickFrom(Quiz.Id, Quiz.Statements, StudyItems.StatementKey, Quiz.Statements.Count).Select(StudyItems.TrueFalse).ToList(),
        _ => Quiz.ShortAnswers.Count > 0
            ? StudyHistory.PickFrom(Quiz.Id, Quiz.ShortAnswers, StudyItems.ShortAnswerKey, Quiz.ShortAnswers.Count).Select(StudyItems.Written).ToList()
            : StudyItems.Shuffle(Quiz.Terms).Select(StudyItems.WrittenFromTerm).ToList(),
    };

    protected override void Start()
    {
        foreach (var kind in Enum.GetValues<ItemKind>().Where(k => PoolSize(k) > 0))
            _chosen.Add(kind);
        _count = Math.Min(Max, 20);
        Setup();
    }

    void Setup()
    {
        Host.SetProgress(null);
        Host.SetStat("");
        var stack = new VerticalStackLayout { Spacing = 14 };
        stack.Children.Add(Ui.Text("Set up your test", 22, bold: true));

        var countLabel = Ui.Text("", 15, bold: true);
        // A stepper's maximum has to be above its minimum, so a set with one question still gets 2 (the count stays 1).
        var stepper = new Stepper { Minimum = 1, Maximum = Math.Max(2, Max), Increment = 1, Value = _count };
        void ShowCount() => countLabel.Text = _count == 1 ? "1 question" : $"{_count} questions";
        stepper.ValueChanged += (_, e) =>
        {
            _count = Math.Min((int)e.NewValue, Max);
            ShowCount();
        };
        ShowCount();
        var countRow = new Grid { ColumnDefinitions = [new(GridLength.Star), new(GridLength.Auto)] };
        countRow.Add(countLabel, 0);
        countRow.Add(stepper, 1);
        stack.Children.Add(Ui.Card(countRow, 14));

        stack.Children.Add(Ui.Overline("QUESTION TYPES"));
        var types = new VerticalStackLayout();
        foreach (var (kind, title) in new[] { (ItemKind.Choice, "Multiple choice"), (ItemKind.TrueFalse, "True / false"), (ItemKind.Written, "Written") })
        {
            var available = PoolSize(kind) > 0;
            var box = new CheckBox { IsChecked = _chosen.Contains(kind), IsEnabled = available, VerticalOptions = LayoutOptions.Center };
            box.CheckedChanged += (_, e) =>
            {
                if (e.Value)
                    _chosen.Add(kind);
                else if (_chosen.Count > 1)
                    _chosen.Remove(kind);
                else
                    box.IsChecked = true;
                stepper.Maximum = Math.Max(2, Max);
                if (_count > Max)
                    stepper.Value = Max;
                _count = Math.Min(_count, Max);
                ShowCount();
            };
            var row = new Grid { ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star)], ColumnSpacing = 6, Opacity = available ? 1 : 0.4 };
            row.Add(box, 0);
            row.Add(Ui.Stack(0, Ui.Text(title), Ui.Caption(available ? $"{PoolSize(kind)} in this set" : "None in this set")), 1);
            types.Children.Add(row);
        }
        stack.Children.Add(Ui.Card(types, 8));

        var timed = new Switch { IsToggled = _timed, VerticalOptions = LayoutOptions.Center };
        timed.Toggled += (_, e) => _timed = e.Value;
        var timedRow = new Grid { ColumnDefinitions = [new(GridLength.Star), new(GridLength.Auto)] };
        timedRow.Add(Ui.Stack(0, Ui.Text("Timed"), Ui.Caption("A minute per question; handed in when time's up")), 0);
        timedRow.Add(timed, 1);
        stack.Children.Add(Ui.Card(timedRow, 14));

        stack.Children.Add(Ui.Primary("Start test", Begin));
        Show(stack);
    }

    void Begin()
    {
        // Taking turns between the chosen types, each from its own pool.
        var queues = _chosen.Select(k => new Queue<StudyItem>(Pool(k))).ToList();
        var items = new List<StudyItem>();
        while (items.Count < _count && queues.Any(q => q.Count > 0))
            foreach (var queue in queues)
                if (items.Count < _count && queue.Count > 0)
                    items.Add(queue.Dequeue());
        _items = StudyItems.Shuffle(items);
        _submitted = false;
        _cards.Clear();

        var stack = new VerticalStackLayout { Spacing = 22 };
        for (var i = 0; i < _items.Count; i++)
        {
            var card = new ItemCard(_items[i], feedback: false, number: i + 1);
            card.Answered += (_, _) => Host.SetProgress((double)_cards.Count(c => c.IsAnswered) / _items.Count);
            _cards.Add(card);
            stack.Children.Add(Ui.Card(card));
        }
        stack.Children.Add(Ui.Primary("Hand in", () => _ = SubmitAsync(false)));
        Show(stack);
        Host.SetProgress(0);

        _startedAt = DateTime.UtcNow;
        _timer = Dispatcher.CreateTimer();
        _timer.Interval = TimeSpan.FromMilliseconds(250);
        _timer.Tick += (_, _) => Tick();
        _timer.Start();
        Tick();
    }

    void Tick()
    {
        var elapsed = DateTime.UtcNow - _startedAt;
        if (_timed)
        {
            var left = TimeSpan.FromMinutes(_items.Count) - elapsed;
            Host.SetStat($"⏱ {StudyItems.FormatTime(left)}");
            if (left <= TimeSpan.Zero)
                _ = SubmitAsync(true);
        }
        else
            Host.SetStat(StudyItems.FormatTime(elapsed));
    }

    async Task SubmitAsync(bool timeUp)
    {
        if (_submitted)
            return;
        var unanswered = _cards.Count(c => !c.IsAnswered);
        if (!timeUp && unanswered > 0 && !await Dialogs.Confirm("Hand in now?",
                unanswered == 1 ? "1 question isn't answered yet." : $"{unanswered} questions aren't answered yet.", "Hand in", "Keep going"))
            return;
        _submitted = true;
        Stop();
        var review = _items.Select((item, i) => ResultsView.Row(item, _cards[i].Given)).ToList();
        var right = review.Count(r => r.Correct);
        foreach (var (item, row) in _items.Zip(review))
            if (item.HistoryKey != null)
                StudyHistory.Record(Quiz.Id, item.HistoryKey, row.Correct);
        _ = Api.SaveScoreAsync(Quiz.Id, 100.0 * right / _items.Count);
        Host.SetProgress(1);
        Host.SetStat(StudyItems.FormatTime(DateTime.UtcNow - _startedAt));
        Show(new ResultsView(right, _items.Count, review,
        [
            ("New test", Setup, true),
            ("Back to study modes", () => _ = Host.ExitAsync(), false),
        ], timeUp ? "Time's up: your test was handed in." : null));
    }

    public override void Stop()
    {
        _timer?.Stop();
        _timer = null;
    }
}
