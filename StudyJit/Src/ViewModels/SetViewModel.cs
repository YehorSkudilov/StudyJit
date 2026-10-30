using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.ViewModels;

/// <summary>
/// A study set or exam (?id=): what's in it, the last score, and the ways to study it; or, while the AI writes it, how
/// far it has got.
/// </summary>
public partial class SetViewModel(ApiClient api, DialogService dialogs) : BaseViewModel, IQueryAttributable
{
    int _id;
    bool _loaded;
    IDispatcherTimer? _poll;

    public ObservableCollection<ModeItem> Modes { get; } = [];

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (query.TryGetValue("id", out var id) && int.TryParse(id.ToString(), out var value) && value != _id)
        {
            _id = value;
            _loaded = false;
        }
    }

    [ObservableProperty]
    public partial string Name { get; set; } = "";

    [ObservableProperty]
    public partial string Description { get; set; } = "";

    [ObservableProperty]
    public partial string Kind { get; set; } = "";

    [ObservableProperty]
    public partial string Contents { get; set; } = "";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasScore))]
    public partial string? Score { get; set; }

    public bool HasScore => Score != null;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsNotReady))]
    public partial bool IsReady { get; set; }

    public bool IsNotReady => !IsReady && !IsLoading;

    [ObservableProperty]
    public partial bool IsRunning { get; set; }

    [ObservableProperty]
    public partial string StatusTitle { get; set; } = "";

    [ObservableProperty]
    public partial string StatusText { get; set; } = "";

    [ObservableProperty]
    public partial double Progress { get; set; }

    protected override void OnPropertyChanged(System.ComponentModel.PropertyChangedEventArgs e)
    {
        base.OnPropertyChanged(e);
        if (e.PropertyName == nameof(IsLoading))
            OnPropertyChanged(nameof(IsNotReady));
    }

    public override async Task OnAppearingAsync()
    {
        if (_id == 0)
            return;
        await LoadAsync(LoadCoreAsync, !_loaded);
    }

    async Task LoadCoreAsync()
    {
        var quiz = await api.QuizAsync(_id);
        _loaded = true;
        Name = quiz.Name;
        Description = quiz.Description ?? "";
        Kind = quiz.Kind == "exam" ? "EXAM" : "STUDY SET";
        Score = quiz.LastScore is { } s ? $"{s:0}%" : null;
        IsReady = quiz.GenerationStatus == GenerationStatus.Success;
        IsRunning = GenerationStatus.IsRunning(quiz.GenerationStatus);
        Contents = string.Join(" · ", new[]
        {
            Count(quiz.Questions.Count, "question"), Count(quiz.Terms.Count, "key term"), Count(quiz.Statements.Count, "true or false"),
            Count(quiz.ShortAnswers.Count, "short answer"), Count(quiz.WrittenAnswers.Count, "exam question"),
        }.Where(p => p != null));

        (StatusTitle, StatusText) = quiz.GenerationStatus switch
        {
            GenerationStatus.Queued => ("Waiting its turn", quiz.QueueNumber is > 0 and var n ? $"Number {n} in the queue. It starts on its own." : "It starts on its own."),
            GenerationStatus.Pending => ("The AI is writing it", StageText(quiz.Progress)),
            GenerationStatus.Failed => ("Generation failed", "Something went wrong writing this set. Try regenerating it."),
            GenerationStatus.Success => ("", ""),
            _ => ("Not generated yet", "Add files to its folder, or regenerate it."),
        };
        Progress = (quiz.Progress?.Percent ?? 0) / 100.0;

        Modes.Clear();
        if (IsReady)
            foreach (var mode in StudyModes.All)
            {
                var unavailable = mode.Unavailable(quiz);
                Modes.Add(new(mode, unavailable, new AsyncRelayCommand(() => OpenModeAsync(mode, unavailable))));
            }

        if (IsRunning)
            StartPolling();
        else
            StopPolling();
    }

    static string? Count(int n, string what) => n == 0 ? null : n == 1 ? $"1 {what}" : $"{n} {what}s";

    static string StageText(GenerationProgressInfo? p) => p?.Stage switch
    {
        null => "This takes a few minutes. You can leave this page.",
        "reading" => p.FilesTotal > 0 ? $"Reading your files ({p.FilesDone} of {p.FilesTotal})" : "Reading your files",
        "indexing" => "Making your files searchable",
        "thinking" => "Working out what matters",
        "questions" => $"Writing questions ({p.Questions} so far)",
        "true_false" => "Writing true-or-false statements",
        "short_answers" => "Writing short-answer questions",
        "written_answers" => "Writing exam-style questions",
        "summary" => "Writing the study guide",
        "terms" => $"Picking out key terms ({p.Terms} so far)",
        "cheat_sheet" => "Writing the cheat sheet",
        "saving" => "Saving",
        _ => "This takes a few minutes. You can leave this page.",
    };

    void StartPolling()
    {
        if (_poll != null)
            return;
        _poll = Application.Current!.Dispatcher.CreateTimer();
        _poll.Interval = TimeSpan.FromSeconds(3);
        _poll.Tick += async (_, _) => await LoadAsync(LoadCoreAsync, false);
        _poll.Start();
    }

    void StopPolling()
    {
        _poll?.Stop();
        _poll = null;
    }

    public override void OnDisappearing() => StopPolling();

    async Task OpenModeAsync(ModeInfo mode, string? unavailable)
    {
        if (unavailable != null)
        {
            await dialogs.Alert(mode.Title, $"{unavailable}: this set was made before it had them.");
            return;
        }
        await GoTo($"{Routes.Study}?id={_id}&mode={mode.Mode}");
    }

    [RelayCommand]
    async Task Regenerate()
    {
        if (!await dialogs.Confirm("Regenerate?", "The AI writes this set again from its files, with fresh questions. It takes a few minutes.", "Regenerate"))
            return;
        try
        {
            await api.RegenerateAsync([_id]);
        }
        catch (Exception e)
        {
            await dialogs.Error(e, "Couldn't start regenerating");
        }
        await LoadAsync(LoadCoreAsync, false);
    }

    [RelayCommand]
    async Task Delete()
    {
        if (!await dialogs.Confirm($"Delete {Name}?", "A folder's study set is made again when its files change.", "Delete"))
            return;
        try
        {
            await api.DeleteQuizzesAsync([_id]);
            await GoBack();
        }
        catch (Exception e)
        {
            await dialogs.Error(e, "Couldn't delete it");
        }
    }
}
