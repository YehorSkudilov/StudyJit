using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.ViewModels;

/// <summary>
/// A course (?id=): its study sets (one per folder of files, made automatically), its exams, and its files by folder,
/// with uploading, YouTube videos, the AI's folder sorting, and editing or deleting the course.
/// </summary>
public partial class CourseViewModel(ApiClient api, DialogService dialogs) : BaseViewModel, IQueryAttributable
{
    int _id;
    bool _loaded;
    Course? _course;
    List<CourseFolder> _folders = [];
    IDispatcherTimer? _poll;

    public ObservableCollection<QuizItem> Sets { get; } = [];
    public ObservableCollection<QuizItem> Exams { get; } = [];
    public ObservableCollection<FolderGroup> Folders { get; } = [];

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (query.TryGetValue("id", out var id) && int.TryParse(id.ToString(), out var value) && value != _id)
        {
            _id = value;
            _loaded = false;
        }
    }

    [ObservableProperty]
    public partial string Title { get; set; } = "";

    [ObservableProperty]
    public partial string Code { get; set; } = "";

    [ObservableProperty]
    public partial string Term { get; set; } = "";

    [ObservableProperty]
    public partial Brush? Gradient { get; set; }

    [ObservableProperty]
    public partial string Summary { get; set; } = "";

    /// <summary>0 study sets, 1 exams, 2 files.</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsSetsTab), nameof(IsExamsTab), nameof(IsFilesTab))]
    public partial int Section { get; set; }

    public bool IsSetsTab => Section == 0;
    public bool IsExamsTab => Section == 1;
    public bool IsFilesTab => Section == 2;

    [ObservableProperty]
    public partial bool NoSets { get; set; }

    [ObservableProperty]
    public partial bool NoExams { get; set; }

    [ObservableProperty]
    public partial bool NoFiles { get; set; }

    /// <summary>What's being uploaded ("Lecture 3.pdf · 40%"), shown over the Files tab while it runs.</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsUploading))]
    public partial string? Upload { get; set; }

    public bool IsUploading => Upload != null;

    [ObservableProperty]
    public partial double UploadProgress { get; set; }

    [ObservableProperty]
    public partial bool IsWorking { get; set; }

    [RelayCommand]
    void ShowSection(string section) => Section = int.Parse(section);

    public override async Task OnAppearingAsync()
    {
        if (_id == 0)
            return;
        await LoadAsync(LoadCoreAsync, !_loaded);
    }

    async Task LoadCoreAsync()
    {
        var courseTask = api.CourseAsync(_id);
        var quizzesTask = api.QuizzesAsync(_id);
        var filesTask = api.FilesAsync(_id);
        var foldersTask = api.FoldersAsync(_id);
        var course = await courseTask;
        var quizzes = await quizzesTask;
        var files = await filesTask;
        _folders = await foldersTask;
        _course = course;
        _loaded = true;

        Title = course.Name;
        Code = course.Code.Length > 0 ? course.Code : "Course";
        Term = course.Term;
        Gradient = CourseColors.Gradient(course.Color);
        Summary = string.Join(" · ", new[]
        {
            course.Term,
            course.ReadyCount == 1 ? "1 set ready" : $"{course.ReadyCount} sets ready",
            course.AverageScore is { } s ? $"{s:0}% average" : "",
        }.Where(p => p.Length > 0));

        QuizItem Item(QuizSummary q) => new(q, null, course.Color, new AsyncRelayCommand(() => GoTo($"{Routes.Set}?id={q.Id}")));
        Sets.Clear();
        foreach (var q in quizzes.Where(q => !q.IsExam).OrderBy(q => q.Name, StringComparer.CurrentCultureIgnoreCase))
            Sets.Add(Item(q));
        Exams.Clear();
        foreach (var q in quizzes.Where(q => q.IsExam))
            Exams.Add(Item(q));
        NoSets = Sets.Count == 0;
        NoExams = Exams.Count == 0;

        Folders.Clear();
        FileItem File(CourseFile f) => new(f, new AsyncRelayCommand(() => FileMenuAsync(f)));
        foreach (var folder in _folders)
            Folders.Add(new(folder.Name, folder.Id, files.Where(f => f.FolderId == folder.Id).Select(File).ToList(),
                new AsyncRelayCommand(() => FolderMenuAsync(folder))));
        var loose = files.Where(f => f.FolderId == null || _folders.All(x => x.Id != f.FolderId)).Select(File).ToList();
        if (loose.Count > 0)
            Folders.Add(new(_folders.Count > 0 ? "Not in a folder" : "Files", null, loose, null));
        NoFiles = files.Count == 0;

        if (quizzes.Any(q => GenerationStatus.IsRunning(q.GenerationStatus)))
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
        _poll.Tick += async (_, _) => await LoadAsync(LoadCoreAsync, false);
        _poll.Start();
    }

    void StopPolling()
    {
        _poll?.Stop();
        _poll = null;
    }

    public override void OnDisappearing() => StopPolling();

    async Task RunAsync(Func<Task> work, string errorTitle)
    {
        if (IsWorking)
            return;
        IsWorking = true;
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
            IsWorking = false;
        }
        await LoadAsync(LoadCoreAsync, false);
    }

    // ---------- The course ----------

    [RelayCommand]
    async Task Menu()
    {
        if (_course == null)
            return;
        const string edit = "Edit name, code and term", color = "Change colour", regenerate = "Regenerate every study set";
        switch (await dialogs.ActionSheet(_course.Title, "Delete course", edit, color, regenerate))
        {
            case edit:
                await EditAsync();
                break;
            case color:
                await ColorAsync();
                break;
            case regenerate:
                if (Sets.Count == 0)
                    await dialogs.Alert("No study sets yet", "Upload files first: each folder of files becomes a study set.");
                else if (await dialogs.Confirm("Regenerate every study set?", "The AI writes each one again from its files. It takes a few minutes.", "Regenerate"))
                    await RunAsync(() => api.RegenerateAsync(Sets.Select(s => s.Quiz.Id)), "Couldn't start regenerating");
                break;
            case "Delete course":
                if (await dialogs.Confirm($"Delete {_course.Title}?", "Its study sets, exams and files go too. This can't be undone.", "Delete"))
                {
                    try
                    {
                        await api.DeleteCourseAsync(_id);
                        await GoBack();
                    }
                    catch (Exception e)
                    {
                        await dialogs.Error(e, "Couldn't delete the course");
                    }
                }
                break;
        }
    }

    async Task EditAsync()
    {
        if (_course == null)
            return;
        var name = await dialogs.Prompt("Course name", "What's the course called?", "Next", _course.Name);
        if (string.IsNullOrWhiteSpace(name))
            return;
        var code = await dialogs.Prompt("Course code", "Optional, e.g. CS 101.", "Next", _course.Code);
        if (code == null)
            return;
        var term = await dialogs.Prompt("Term", "Optional, e.g. Fall 2026.", "Save", _course.Term);
        if (term == null)
            return;
        await RunAsync(() => api.UpdateCourseAsync(_id, new(code.Trim(), name.Trim(), term.Trim())), "Couldn't save the course");
    }

    async Task ColorAsync()
    {
        var names = CourseColors.Names.Select(n => char.ToUpperInvariant(n[0]) + n[1..]).ToArray();
        if (await dialogs.ActionSheet("Course colour", null, names) is not { } picked)
            return;
        await RunAsync(() => api.UpdateCourseAsync(_id, new(null, null, null, picked.ToLowerInvariant())), "Couldn't change the colour");
    }

    // ---------- Exams ----------

    [RelayCommand]
    async Task NewExam()
    {
        if (Sets.All(s => !s.IsReady))
        {
            await dialogs.Alert("No study sets ready yet", "An exam is written from the course's study sets, so it needs at least one that's ready.");
            return;
        }
        await GoTo($"{Routes.NewExam}?course={_id}");
    }

    // ---------- Files ----------

    [RelayCommand]
    async Task UploadFiles()
    {
        IEnumerable<FileResult?> picked;
        try
        {
            picked = await FilePicker.Default.PickMultipleAsync(new PickOptions { PickerTitle = "Course files" }) ?? [];
        }
        catch (Exception)
        {
            await dialogs.Alert("Couldn't open your files", "Please try again.");
            return;
        }
        var files = picked.OfType<FileResult>().ToList();
        if (files.Count == 0)
            return;
        var folderId = await PickFolderAsync("Put them in a folder?");
        if (folderId == -1)
            return;
        await RunAsync(async () =>
        {
            try
            {
                for (var i = 0; i < files.Count; i++)
                {
                    var file = files[i];
                    var label = files.Count > 1 ? $"{file.FileName} ({i + 1} of {files.Count})" : file.FileName;
                    Upload = label;
                    UploadProgress = 0;
                    await using var stream = await file.OpenReadAsync();
                    var size = stream.CanSeek ? stream.Length : await CopyLengthAsync(file);
                    var progress = new Progress<double>(p => UploadProgress = p);
                    await api.UploadFileAsync(stream, size, file.FileName, _id, folderId, progress);
                }
            }
            finally
            {
                Upload = null;
            }
        }, "Upload failed");
        Section = 2;
    }

    // A stream that can't tell its length (some Android providers): read it once to count.
    static async Task<long> CopyLengthAsync(FileResult file)
    {
        await using var stream = await file.OpenReadAsync();
        var buffer = new byte[81920];
        long total = 0;
        int n;
        while ((n = await stream.ReadAsync(buffer)) > 0)
            total += n;
        return total;
    }

    [RelayCommand]
    async Task AddVideo()
    {
        var url = await dialogs.Prompt("YouTube video", "Paste the video's link: StudyJit downloads it and studies what's said.", "Add",
            placeholder: "https://youtube.com/watch?v=…", keyboard: Keyboard.Url);
        if (string.IsNullOrWhiteSpace(url))
            return;
        var folderId = await PickFolderAsync("Put it in a folder?");
        if (folderId == -1)
            return;
        await RunAsync(async () =>
        {
            try
            {
                Upload = "Downloading the video";
                UploadProgress = 0;
                await api.UploadYouTubeAsync(url, _id, folderId, new Progress<double>(p => UploadProgress = p));
            }
            finally
            {
                Upload = null;
            }
        }, "Couldn't add the video");
        Section = 2;
    }

    /// <summary>A folder for new files: its id, null for none, or -1 when cancelled.</summary>
    async Task<int?> PickFolderAsync(string title)
    {
        const string none = "No folder", create = "New folder…";
        var choice = await dialogs.ActionSheet(title, null, [.. _folders.Select(f => f.Name), create, none]);
        switch (choice)
        {
            case null:
                return -1;
            case none:
                return null;
            case create:
                var name = await dialogs.Prompt("New folder", "E.g. Week 3, or Midterm topics.", "Create");
                if (string.IsNullOrWhiteSpace(name))
                    return -1;
                try
                {
                    var folder = await api.CreateFolderAsync(_id, name.Trim());
                    _folders.Add(folder);
                    return folder.Id;
                }
                catch (Exception e)
                {
                    await dialogs.Error(e, "Couldn't create the folder");
                    return -1;
                }
            default:
                return _folders.First(f => f.Name == choice).Id;
        }
    }

    [RelayCommand]
    async Task NewFolder()
    {
        var name = await dialogs.Prompt("New folder", "Each folder of files gets its own study set. E.g. Week 3.", "Create");
        if (!string.IsNullOrWhiteSpace(name))
            await RunAsync(() => api.CreateFolderAsync(_id, name.Trim()), "Couldn't create the folder");
    }

    /// <summary>The AI suggests folders (e.g. one per week) from what's in the files; they're shown before anything moves.</summary>
    [RelayCommand]
    async Task Organize()
    {
        if (NoFiles)
        {
            await dialogs.Alert("No files yet", "Upload some files first.");
            return;
        }
        List<FolderPlan>? plan = null;
        await RunAsync(async () => plan = await api.OrganizeFilesAsync(_id), "The AI couldn't sort the files");
        if (plan is not { Count: > 0 })
            return;
        var names = Folders.SelectMany(g => g.Files).ToDictionary(f => f.File.Id, f => f.Name);
        var summary = string.Join("\n\n", plan.Select(p =>
            $"{p.Name}\n" + string.Join("\n", p.FileIds.Select(id => "  • " + names.GetValueOrDefault(id, "a file")))));
        if (await dialogs.Confirm("Sort into these folders?", summary, "Sort files", "Keep as they are"))
            await RunAsync(() => api.ApplyFoldersAsync(_id, plan), "Couldn't sort the files");
    }

    async Task FileMenuAsync(CourseFile file)
    {
        const string move = "Move to a folder";
        switch (await dialogs.ActionSheet(file.Name, "Delete file", move))
        {
            case move:
                var folderId = await PickFolderAsync("Move to");
                if (folderId != -1)
                    await RunAsync(() => api.MoveFilesAsync(_id, [file.Id], folderId), "Couldn't move the file");
                break;
            case "Delete file":
                if (await dialogs.Confirm($"Delete {file.Name}?", "Its folder's study set is made again without it.", "Delete"))
                    await RunAsync(() => api.DeleteFilesAsync([file.Id]), "Couldn't delete the file");
                break;
        }
    }

    async Task FolderMenuAsync(CourseFolder folder)
    {
        const string rename = "Rename";
        switch (await dialogs.ActionSheet(folder.Name, "Delete folder", rename))
        {
            case rename:
                var name = await dialogs.Prompt("Rename folder", "", "Save", folder.Name);
                if (!string.IsNullOrWhiteSpace(name))
                    await RunAsync(() => api.RenameFolderAsync(_id, folder.Id, name.Trim()), "Couldn't rename the folder");
                break;
            case "Delete folder":
                if (await dialogs.Confirm($"Delete {folder.Name}?", "Its files stay in the course, out of any folder.", "Delete"))
                    await RunAsync(() => api.DeleteFolderAsync(_id, folder.Id), "Couldn't delete the folder");
                break;
        }
    }
}
