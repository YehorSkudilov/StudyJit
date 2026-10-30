using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>True or False: a 60-second blitz. Right answers in a row build a combo that's worth more; best score kept.</summary>
public class TrueFalseMode : ModeView
{
    static readonly TimeSpan Duration = TimeSpan.FromSeconds(60);

    Queue<Statement> _queue = new();
    int _points, _combo, _right, _wrong;
    DateTime _startedAt;
    IDispatcherTimer? _timer;
    Label _statement = null!, _comboLabel = null!;
    bool _over;
    readonly List<ReviewRow> _misses = [];

    string BestKey => $"truefalse.{Quiz.Id}";

    protected override void Start() => Intro();

    void Intro()
    {
        Host.SetProgress(null);
        Host.SetStat("");
        var best = StudyHistory.Best(BestKey);
        Show(Ui.Stack(14,
            Ui.Icon("bolt", 56, "Danger"),
            Ui.Text("True or False", 24, bold: true, align: TextAlignment.Center),
            Ui.Caption("60 seconds. Judge each statement as fast as you can: answers in a row build a combo worth more points.", TextAlignment.Center),
            Ui.Caption(best is { } b ? $"Your best: {b:0} points" : "No best score yet", TextAlignment.Center),
            Ui.Primary("Start", Begin)));
    }

    void Refill() => _queue = new(StudyHistory.PickFrom(Quiz.Id, Quiz.Statements, StudyItems.StatementKey, Quiz.Statements.Count));

    void Begin()
    {
        _points = _combo = _right = _wrong = 0;
        _over = false;
        _misses.Clear();
        Refill();
        _statement = Ui.Text("", 20, bold: true, align: TextAlignment.Center);
        _comboLabel = Ui.Caption("", TextAlignment.Center);
        var card = Ui.Card(_statement, 22);
        card.MinimumHeightRequest = 220;
        _statement.VerticalOptions = LayoutOptions.Center;
        var yes = new Button { Text = "True", Style = Ui.Style("PrimaryButton"), BackgroundColor = Ui.Color("Success"), TextColor = Ui.Color("Bg") };
        var no = new Button { Text = "False", Style = Ui.Style("PrimaryButton"), BackgroundColor = Ui.Color("Danger") };
        yes.Clicked += (_, _) => Answer(true, card);
        no.Clicked += (_, _) => Answer(false, card);
        Show(Ui.Stack(16, _comboLabel, card, Ui.Pair(no, yes)));
        NextStatement();

        _startedAt = DateTime.UtcNow;
        _timer = Dispatcher.CreateTimer();
        _timer.Interval = TimeSpan.FromMilliseconds(100);
        _timer.Tick += (_, _) => Tick();
        _timer.Start();
    }

    void NextStatement()
    {
        if (_queue.Count == 0)
            Refill();
        _statement.Text = _queue.Peek().Text;
        _comboLabel.Text = _combo >= 2 ? $"🔥 Combo ×{Multiplier} · {_points} points" : $"{_points} points";
    }

    int Multiplier => 1 + Math.Min(_combo / 3, 4);

    void Answer(bool said, View card)
    {
        if (_over)
            return;
        var statement = _queue.Dequeue();
        var right = statement.IsTrue == said;
        StudyHistory.Record(Quiz.Id, StudyItems.StatementKey(statement), right);
        Ui.Buzz(right);
        if (right)
        {
            _combo++;
            _right++;
            _points += 10 * Multiplier;
        }
        else
        {
            _combo = 0;
            _wrong++;
            _misses.Add(new(statement.Text, statement.IsTrue ? "True" : "False", said ? "True" : "False", false, statement.Explanation));
        }
        card.BackgroundColor = Ui.Color(right ? "SuccessSoft" : "DangerSoft");
        _ = card.ScaleToAsync(right ? 1.03 : 0.97, 80).ContinueWith(_ => MainThread.BeginInvokeOnMainThread(() =>
        {
            card.Scale = 1;
            card.BackgroundColor = Ui.Color("Surface");
        }));
        NextStatement();
    }

    void Tick()
    {
        var left = Duration - (DateTime.UtcNow - _startedAt);
        Host.SetProgress(1 - left / Duration);
        Host.SetStat($"⏱ {Math.Max(0, (int)Math.Ceiling(left.TotalSeconds))}s");
        if (left <= TimeSpan.Zero)
            Finish();
    }

    void Finish()
    {
        if (_over)
            return;
        _over = true;
        Stop();
        var newBest = StudyHistory.RecordBest(BestKey, _points, lowerIsBetter: false) && _points > 0;
        Host.SetStat($"{_points} pts");
        var stack = Ui.Stack(14,
            Ui.Icon(newBest ? "emoji_events" : "bolt", 56, newBest ? "Warning" : "Danger"),
            Ui.Text($"{_points} points", 34, bold: true, align: TextAlignment.Center),
            Ui.Caption($"{_right} right · {_wrong} wrong" + (newBest ? " · a new best!" : ""), TextAlignment.Center),
            Ui.Primary("Play again", Begin),
            Ui.Secondary("Back to study modes", () => _ = Host.ExitAsync()));
        if (ResultsView.Misses(_misses) is { } misses)
            stack.Children.Add(misses);
        Show(stack);
    }

    public override void Stop()
    {
        _timer?.Stop();
        _timer = null;
    }
}
