using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.ViewModels;

/// <summary>A new exam for a course (?course=): its name, the study sets it covers, and anything to focus on.</summary>
public partial class NewExamViewModel(ApiClient api, DialogService dialogs) : BaseViewModel, IQueryAttributable
{
    int _courseId;

    public ObservableCollection<PickItem> Sets { get; } = [];

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (query.TryGetValue("course", out var id) && int.TryParse(id.ToString(), out var value))
            _courseId = value;
    }

    [ObservableProperty]
    public partial string Name { get; set; } = "";

    [ObservableProperty]
    public partial string Focus { get; set; } = "";

    [ObservableProperty]
    public partial bool IsSaving { get; set; }

    public override async Task OnAppearingAsync()
    {
        if (Sets.Count > 0)
            return;
        await LoadAsync(async () =>
        {
            var quizzes = await api.QuizzesAsync(_courseId);
            foreach (var q in quizzes.Where(q => !q.IsExam && q.GenerationStatus == GenerationStatus.Success).OrderBy(q => q.Name))
                Sets.Add(new(q));
        }, true);
    }

    [RelayCommand]
    async Task Create()
    {
        var picked = Sets.Where(s => s.IsPicked).Select(s => s.Quiz.Id).ToList();
        if (string.IsNullOrWhiteSpace(Name))
        {
            await dialogs.Alert("Name the exam", "E.g. Midterm 1, or Final exam.");
            return;
        }
        if (picked.Count == 0)
        {
            await dialogs.Alert("Pick what it covers", "Tick at least one study set.");
            return;
        }
        IsSaving = true;
        try
        {
            var exam = await api.CreateExamAsync(_courseId, Name.Trim(), picked, Focus.Trim());
            // To the exam's own page, which shows its progress while it's written.
            await Shell.Current.GoToAsync($"../{Routes.Set}?id={exam.Id}");
        }
        catch (Exception e)
        {
            await dialogs.Error(e, "Couldn't create the exam");
        }
        finally
        {
            IsSaving = false;
        }
    }
}
