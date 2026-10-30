using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>Match: pair terms with their definitions against the clock; a wrong pair adds a second. Best time kept.</summary>
public class MatchMode : ModeView
{
    const int Pairs = 6;
    static readonly TimeSpan Penalty = TimeSpan.FromSeconds(1);

    record Tile(int Pair, string Text, bool IsTerm);

    readonly Dictionary<Button, Tile> _tiles = [];
    Button? _picked;
    int _matched;
    TimeSpan _penalty;
    DateTime _startedAt;
    IDispatcherTimer? _timer;

    string BestKey => $"match.{Quiz.Id}";

    protected override void Start() => Intro();

    void Intro()
    {
        Host.SetProgress(null);
        Host.SetStat("");
        var best = Progress.Best(BestKey);
        Show(Ui.Stack(14,
            Ui.Icon("extension", 56, "Warning"),
            Ui.Text("Match", 24, bold: true, align: TextAlignment.Center),
            Ui.Caption($"Tap a term, then its definition. Clear the board as fast as you can: each wrong pair adds a second.", TextAlignment.Center),
            Ui.Caption(best is { } b ? $"Your best: {StudyItems.FormatTime(TimeSpan.FromMilliseconds(b))}" : "No best time yet", TextAlignment.Center),
            Ui.Primary("Start", Begin)));
    }

    void Begin()
    {
        var terms = StudyItems.Sample(Quiz.Terms, Pairs);
        var tiles = StudyItems.Shuffle(terms.SelectMany((t, i) => new[] { new Tile(i, t.Name, true), new Tile(i, Shorten(t.Definition), false) }));
        _tiles.Clear();
        _picked = null;
        _matched = 0;
        _penalty = TimeSpan.Zero;

        var grid = new Grid { ColumnDefinitions = [new(GridLength.Star), new(GridLength.Star)], ColumnSpacing = 10, RowSpacing = 10 };
        for (var i = 0; i < tiles.Count; i++)
        {
            if (i % 2 == 0)
                grid.RowDefinitions.Add(new(GridLength.Auto));
            var tile = tiles[i];
            var button = new Button
            {
                Text = tile.Text,
                Style = Ui.Style("ChoiceButton"),
                FontSize = tile.IsTerm ? 15 : 13,
                FontFamily = tile.IsTerm ? "OpenSansSemibold" : "OpenSansRegular",
                MinimumHeightRequest = 96,
            };
            button.Clicked += (_, _) => _ = PickAsync(button);
            _tiles[button] = tile;
            grid.Add(button, i % 2, i / 2);
        }
        Show(grid);

        _startedAt = DateTime.UtcNow;
        _timer = Dispatcher.CreateTimer();
        _timer.Interval = TimeSpan.FromMilliseconds(100);
        _timer.Tick += (_, _) => Host.SetStat(StudyItems.FormatTime(Elapsed));
        _timer.Start();
        Host.SetProgress(0);
    }

    TimeSpan Elapsed => DateTime.UtcNow - _startedAt + _penalty;

    static string Shorten(string text) => text.Length > 110 ? text[..107].TrimEnd() + "…" : text;

    async Task PickAsync(Button button)
    {
        if (!button.IsEnabled)
            return;
        if (_picked == null)
        {
            _picked = button;
            button.BorderColor = Ui.Color("Accent");
            button.BackgroundColor = Ui.Color("AccentSoft");
            return;
        }
        if (_picked == button)
        {
            Reset(button);
            _picked = null;
            return;
        }
        var first = _picked;
        _picked = null;
        var (a, b) = (_tiles[first], _tiles[button]);
        if (a.Pair == b.Pair && a.IsTerm != b.IsTerm)
        {
            Ui.Buzz(true);
            foreach (var t in new[] { first, button })
            {
                t.IsEnabled = false;
                t.BorderColor = Ui.Color("Success");
                t.BackgroundColor = Ui.Color("SuccessSoft");
                _ = t.FadeToAsync(0.15, 400);
            }
            _matched++;
            Host.SetProgress((double)_matched / (_tiles.Count / 2));
            if (_matched == _tiles.Count / 2)
                Finish();
            return;
        }
        Ui.Buzz(false);
        _penalty += Penalty;
        foreach (var t in new[] { first, button })
        {
            t.BorderColor = Ui.Color("Danger");
            t.BackgroundColor = Ui.Color("DangerSoft");
        }
        await Task.Delay(350);
        Reset(first);
        Reset(button);
    }

    static void Reset(Button button)
    {
        button.BorderColor = Ui.Color("Stroke");
        button.BackgroundColor = Ui.Color("Surface");
    }

    void Finish()
    {
        var time = Elapsed;
        Stop();
        var newBest = Progress.RecordBest(BestKey, time.TotalMilliseconds, lowerIsBetter: true);
        var best = Progress.Best(BestKey) ?? time.TotalMilliseconds;
        Host.SetStat(StudyItems.FormatTime(time));
        Show(Ui.Stack(14,
            Ui.Icon(newBest ? "emoji_events" : "timer", 56, newBest ? "Warning" : "Accent"),
            Ui.Text(StudyItems.FormatTime(time), 36, bold: true, align: TextAlignment.Center),
            Ui.Caption(newBest ? "A new best time!" : $"Your best: {StudyItems.FormatTime(TimeSpan.FromMilliseconds(best))}", TextAlignment.Center),
            Ui.Primary("Play again", Begin),
            Ui.Secondary("Back to study modes", () => _ = Host.ExitAsync())));
    }

    public override void Stop()
    {
        _timer?.Stop();
        _timer = null;
    }
}
