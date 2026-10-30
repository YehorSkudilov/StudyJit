using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>
/// What every study mode sits in (the website's StudyShell): a close button, the mode and set's names, a stat on the
/// right (mastered, time, combo), a progress bar, and the mode's own screen under them.
/// </summary>
public abstract class ModeView : ContentView
{
    protected StudyPage Host { get; private set; } = null!;
    protected StudyQuiz Quiz => Host.Quiz;
    protected ApiClient Api => Host.Api;
    protected DialogService Dialogs => Host.Dialogs;

    internal void Attach(StudyPage host)
    {
        Host = host;
        Start();
    }

    /// <summary>Builds the first screen.</summary>
    protected abstract void Start();

    /// <summary>The page is going away: stop timers.</summary>
    public virtual void Stop()
    {
    }

    /// <summary>Puts <paramref name="view"/> on screen in place of what was there, eased in.</summary>
    protected void Show(View view)
    {
        view.Opacity = 0;
        view.TranslationY = 18;
        Content = view;
        _ = Task.WhenAll(view.FadeToAsync(1, 220, Easing.CubicOut), view.TranslateToAsync(0, 0, 260, Easing.CubicOut));
        Host.ScrollToTop();
    }
}

public class StudyPage : ContentPage, IQueryAttributable
{
    readonly Label _mode, _title, _stat;
    readonly ProgressBar _progress;
    readonly ScrollView _scroll;
    readonly ContentView _body;
    int _id;
    StudyMode _which;
    ModeView? _view;

    public StudyPage(ApiClient api, DialogService dialogs)
    {
        Api = api;
        Dialogs = dialogs;
        Shell.SetNavBarIsVisible(this, false);
        BackgroundColor = Ui.Color("Bg");

        var close = new ImageButton
        {
            Source = (ImageSource)Application.Current!.Resources["IconClose"],
            WidthRequest = 40, HeightRequest = 40, Padding = 9, CornerRadius = 20,
            BackgroundColor = Ui.Color("Surface2"),
        };
        close.Clicked += async (_, _) => await Shell.Current.GoToAsync("..");
        _mode = new Label { Style = Ui.Style("Overline") };
        _title = new Label { FontFamily = "OpenSansSemibold", FontSize = 16, LineBreakMode = LineBreakMode.TailTruncation };
        _stat = new Label { FontFamily = "OpenSansSemibold", FontSize = 14, TextColor = Ui.Color("Accent2"), VerticalOptions = LayoutOptions.Center };
        var header = new Grid { ColumnDefinitions = [new(GridLength.Auto), new(GridLength.Star), new(GridLength.Auto)], ColumnSpacing = 12 };
        header.Add(close, 0);
        var names = new VerticalStackLayout { VerticalOptions = LayoutOptions.Center, Children = { _mode, _title } };
        header.Add(names, 1);
        header.Add(_stat, 2);
        _progress = new ProgressBar { Margin = new(0, 12, 0, 0), ProgressColor = Ui.Color("Accent") };

        _body = new ContentView();
        _scroll = new ScrollView { Content = new ContentView { Padding = new(14, 16, 14, 32), Content = _body } };
        var root = new Grid { RowDefinitions = [new(GridLength.Auto), new(GridLength.Star)], Padding = new(0, 10, 0, 0) };
        root.Add(new VerticalStackLayout { Padding = new(14, 6, 14, 0), Children = { header, _progress } }, 0, 0);
        root.Add(_scroll, 0, 1);
        Content = root;
    }

    internal ApiClient Api { get; }
    internal DialogService Dialogs { get; }
    internal StudyQuiz Quiz { get; private set; } = new();

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (query.TryGetValue("id", out var id))
            int.TryParse(id.ToString(), out _id);
        if (query.TryGetValue("mode", out var mode))
            Enum.TryParse(mode.ToString(), out _which);
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        if (_view != null)
            return;
        var info = StudyModes.Of(_which);
        _mode.Text = info.Title.ToUpperInvariant();
        _body.Content = new ActivityIndicator { IsRunning = true, Margin = new(0, 60) };
        try
        {
            Quiz = await Api.QuizAsync(_id);
        }
        catch (Exception e)
        {
            _body.Content = Ui.Caption(e is ApiException ? e.Message : "Couldn't load this study set.", TextAlignment.Center);
            return;
        }
        _title.Text = Quiz.Name;
        _view = _which switch
        {
            StudyMode.Learn => new LearnMode(),
            StudyMode.Flashcards => new FlashcardsMode(),
            StudyMode.Practice => new PracticeMode(),
            StudyMode.Test => new TestMode(),
            StudyMode.Match => new MatchMode(),
            StudyMode.TrueFalse => new TrueFalseMode(),
            StudyMode.Write => new WriteMode(),
            StudyMode.Answers => new AnswersMode(),
            StudyMode.Guide => new ReadMode(guide: true),
            _ => new ReadMode(guide: false),
        };
        _body.Content = _view;
        _view.Attach(this);
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        // Popped off (closed), not covered: nothing comes back to this one.
        if (Shell.Current?.Navigation.NavigationStack.Contains(this) != true)
            _view?.Stop();
    }

    /// <summary>How far through the mode is, 0 to 1; hidden for modes without one.</summary>
    public void SetProgress(double? progress)
    {
        _progress.IsVisible = progress != null;
        _ = _progress.ProgressTo(Math.Clamp(progress ?? 0, 0, 1), 250, Easing.CubicOut);
    }

    public void SetStat(string text) => _stat.Text = text;

    public void ScrollToTop() => _ = _scroll.ScrollToAsync(0, 0, false);

    public Task ExitAsync() => Shell.Current.GoToAsync("..");
}
