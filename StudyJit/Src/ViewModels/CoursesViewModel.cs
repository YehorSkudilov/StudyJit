using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Services;

namespace StudyJit.ViewModels;

/// <summary>The Courses tab: every course as a card; adding one by hand or from a pasted course list.</summary>
public partial class CoursesViewModel(ApiClient api, AuthSession session) : BaseViewModel
{
    bool _loaded;

    public ObservableCollection<CourseItem> Courses { get; } = [];

    [ObservableProperty]
    public partial bool IsEmpty { get; set; }

    public override async Task OnAppearingAsync()
    {
        if (!session.IsSignedIn)
            return;
        await LoadAsync(async () =>
        {
            var courses = await api.CoursesAsync();
            _loaded = true;
            Courses.Clear();
            foreach (var course in courses)
                Courses.Add(new(course, new AsyncRelayCommand(() => GoTo($"{Routes.Course}?id={course.Id}"))));
            IsEmpty = Courses.Count == 0;
        }, !_loaded);
    }

    [RelayCommand]
    Task Add() => GoTo(Routes.NewCourse);
}
