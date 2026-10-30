using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Models;
using StudyJit.Services;
using StudyJit.Services.Offline;

namespace StudyJit.ViewModels;

/// <summary>The Library tab: every study set and exam across the courses, searchable, newest first.</summary>
public partial class LibraryViewModel(StudyData data, AuthSession session) : BaseViewModel
{
    bool _loaded;
    List<QuizItem> _all = [];

    public ObservableCollection<QuizItem> Items { get; } = [];

    [ObservableProperty]
    public partial string Search { get; set; } = "";

    /// <summary>0 everything, 1 study sets, 2 exams.</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsAll), nameof(IsSets), nameof(IsExams))]
    public partial int Filter { get; set; }

    public bool IsAll => Filter == 0;
    public bool IsSets => Filter == 1;
    public bool IsExams => Filter == 2;

    [ObservableProperty]
    public partial bool IsEmpty { get; set; }

    [ObservableProperty]
    public partial string EmptyText { get; set; } = "";

    partial void OnSearchChanged(string value) => Apply();

    partial void OnFilterChanged(int value) => Apply();

    [RelayCommand]
    void SetFilter(string filter) => Filter = int.Parse(filter);

    public override async Task OnAppearingAsync()
    {
        if (!session.IsSignedIn)
            return;
        await LoadAsync(() => CoursesAndSets.Cached(data), () => CoursesAndSets.FetchAsync(data), Show, !_loaded);
    }

    void Show(CoursesAndSets snapshot)
    {
        var (courseList, quizzes) = snapshot;
        var courses = courseList.ToDictionary(c => c.Id);
        _loaded = true;
        _all = quizzes.Select(q =>
        {
            var course = q.CourseId is { } id ? courses.GetValueOrDefault(id) : null;
            return new QuizItem(q, course?.Title, course?.Color, new AsyncRelayCommand(() => GoTo($"{Routes.Set}?id={q.Id}")));
        }).ToList();
        Apply();
    }

    void Apply()
    {
        var words = Search.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var shown = _all.Where(i => Filter switch { 1 => !i.Quiz.IsExam, 2 => i.Quiz.IsExam, _ => true })
            .Where(i => words.All(w => i.Name.Contains(w, StringComparison.OrdinalIgnoreCase)
                                       || (i.CourseTitle?.Contains(w, StringComparison.OrdinalIgnoreCase) ?? false)))
            .ToList();
        Items.Clear();
        foreach (var item in shown)
            Items.Add(item);
        IsEmpty = shown.Count == 0;
        EmptyText = _all.Count == 0
            ? "No study sets yet. Add files to a course and StudyJit makes a study set for each folder."
            : "Nothing matches.";
    }
}
