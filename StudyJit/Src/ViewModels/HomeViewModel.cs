using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Models;
using StudyJit.Services;
using StudyJit.Services.Offline;

namespace StudyJit.ViewModels;

/// <summary>
/// The first tab: a greeting, how studying is going (courses, sets ready, average score), what's being generated now,
/// and the study sets to pick up again.
/// </summary>
public partial class HomeViewModel(StudyData data, AuthSession session) : BaseViewModel
{
    bool _loaded;
    IDispatcherTimer? _poll;

    public ObservableCollection<QuizItem> Generating { get; } = [];
    public ObservableCollection<QuizItem> Recent { get; } = [];

    [ObservableProperty]
    public partial string Greeting { get; set; } = "Welcome";

    [ObservableProperty]
    public partial string CourseCount { get; set; } = "–";

    [ObservableProperty]
    public partial string ReadyCount { get; set; } = "–";

    [ObservableProperty]
    public partial string AverageScore { get; set; } = "–";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasCourses))]
    public partial bool IsEmpty { get; set; }

    public bool HasCourses => !IsEmpty;

    [ObservableProperty]
    public partial bool HasGenerating { get; set; }

    [ObservableProperty]
    public partial bool HasRecent { get; set; }

    public override async Task OnAppearingAsync()
    {
        Greeting = GreetingFor(DateTime.Now, session.Name);
        if (!session.IsSignedIn)
            return;
        await LoadAsync(() => CoursesAndSets.Cached(data), () => CoursesAndSets.FetchAsync(data), Show, !_loaded);
    }

    void Show(CoursesAndSets snapshot)
    {
        var (courses, quizzes) = snapshot;
        _loaded = true;
        var byId = courses.ToDictionary(c => c.Id);
        QuizItem Item(QuizSummary q)
        {
            var course = q.CourseId is { } id ? byId.GetValueOrDefault(id) : null;
            return new(q, course?.Title, course?.Color, new AsyncRelayCommand(() => GoTo($"{Routes.Set}?id={q.Id}")));
        }

        CourseCount = courses.Count.ToString();
        ReadyCount = quizzes.Count(q => q.GenerationStatus == GenerationStatus.Success).ToString();
        var scored = quizzes.Where(q => q.LastScore != null).ToList();
        AverageScore = scored.Count > 0 ? $"{scored.Average(q => q.LastScore!.Value):0}%" : "–";
        IsEmpty = courses.Count == 0;

        Generating.Clear();
        foreach (var q in quizzes.Where(q => GenerationStatus.IsRunning(q.GenerationStatus)))
            Generating.Add(Item(q));
        HasGenerating = Generating.Count > 0;

        // Ready sets, ones not yet practised first (they're what's new), then the lowest scores: what needs studying.
        Recent.Clear();
        foreach (var q in quizzes.Where(q => q.GenerationStatus == GenerationStatus.Success)
                     .OrderBy(q => q.LastScore != null).ThenBy(q => q.LastScore).Take(6))
            Recent.Add(Item(q));
        HasRecent = Recent.Count > 0;

        // While something generates, look again every few seconds for its progress.
        if (HasGenerating)
            StartPolling();
        else
            StopPolling();
    }

    void StartPolling()
    {
        if (_poll != null)
            return;
        _poll = Application.Current!.Dispatcher.CreateTimer();
        _poll.Interval = TimeSpan.FromSeconds(4);
        _poll.Tick += async (_, _) => await LoadAsync(() => CoursesAndSets.Cached(data), () => CoursesAndSets.FetchAsync(data), Show, false);
        _poll.Start();
    }

    void StopPolling()
    {
        _poll?.Stop();
        _poll = null;
    }

    public override void OnDisappearing() => StopPolling();

    [RelayCommand]
    Task AddCourse() => GoTo(Routes.NewCourse);

    [RelayCommand]
    Task OpenCourses() => Views.MainPage.ShowTab(Views.AppTab.Courses);

    static string GreetingFor(DateTime now, string? name)
    {
        var first = name?.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        var hello = now.Hour switch { < 5 => "Studying late", < 12 => "Good morning", < 18 => "Good afternoon", _ => "Good evening" };
        return first == null ? hello : $"{hello}, {first}";
    }
}
