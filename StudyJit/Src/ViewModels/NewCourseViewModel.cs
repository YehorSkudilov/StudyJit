using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.ViewModels;

/// <summary>A draft the AI read from a pasted course list, to tick before creating.</summary>
public partial class DraftItem(CourseDraft draft) : ObservableObject
{
    public CourseDraft Draft { get; } = draft;
    public string Title => string.IsNullOrEmpty(Draft.Code) ? Draft.Name ?? "" : $"{Draft.Code} · {Draft.Name}";
    public string Term => Draft.Term ?? "";
    public bool HasTerm => !string.IsNullOrEmpty(Draft.Term);

    [ObservableProperty]
    public partial bool IsPicked { get; set; } = true;
}

/// <summary>Adding courses: one typed in, or several the AI reads out of a pasted course list (from a school's site).</summary>
public partial class NewCourseViewModel(ApiClient api, DialogService dialogs) : BaseViewModel
{
    public ObservableCollection<DraftItem> Drafts { get; } = [];

    /// <summary>False: typing one course in; true: pasting a list for the AI.</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsManual))]
    public partial bool IsPaste { get; set; }

    public bool IsManual => !IsPaste;

    [ObservableProperty]
    public partial string Name { get; set; } = "";

    [ObservableProperty]
    public partial string Code { get; set; } = "";

    [ObservableProperty]
    public partial string Term { get; set; } = "";

    [ObservableProperty]
    public partial string Pasted { get; set; } = "";

    [ObservableProperty]
    public partial bool HasDrafts { get; set; }

    [ObservableProperty]
    public partial bool IsSaving { get; set; }

    [RelayCommand]
    void ShowMode(string mode) => IsPaste = mode == "paste";

    [RelayCommand]
    async Task CreateOne()
    {
        if (string.IsNullOrWhiteSpace(Name))
        {
            await dialogs.Alert("Name the course", "E.g. Introduction to Psychology.");
            return;
        }
        await SaveAsync(async () =>
        {
            var course = await api.CreateCourseAsync(new(Code.Trim(), Name.Trim(), Term.Trim()));
            await Shell.Current.GoToAsync($"../{Routes.Course}?id={course.Id}");
        }, "Couldn't create the course");
    }

    [RelayCommand]
    async Task Read()
    {
        if (string.IsNullOrWhiteSpace(Pasted))
        {
            await dialogs.Alert("Paste your courses first", "Copy the list of your courses from your school's website and paste it here.");
            return;
        }
        await SaveAsync(async () =>
        {
            var drafts = await api.ParseCoursesAsync(Pasted);
            Drafts.Clear();
            foreach (var draft in drafts)
                Drafts.Add(new(draft));
            HasDrafts = Drafts.Count > 0;
            if (!HasDrafts)
                await dialogs.Alert("No courses found", "The AI couldn't find any courses in that. Try pasting more of the page.");
        }, "The AI couldn't read that");
    }

    [RelayCommand]
    async Task CreateAll()
    {
        var picked = Drafts.Where(d => d.IsPicked).Select(d => d.Draft).ToList();
        if (picked.Count == 0)
            return;
        await SaveAsync(async () =>
        {
            await api.CreateCoursesAsync(picked);
            await GoBack();
        }, "Couldn't create the courses");
    }

    async Task SaveAsync(Func<Task> work, string errorTitle)
    {
        if (IsSaving)
            return;
        IsSaving = true;
        try
        {
            await work();
        }
        catch (Exception e)
        {
            await dialogs.Error(e, errorTitle);
        }
        finally
        {
            IsSaving = false;
        }
    }
}
