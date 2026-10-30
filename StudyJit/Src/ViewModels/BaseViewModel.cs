using CommunityToolkit.Mvvm.ComponentModel;

namespace StudyJit.ViewModels;

public abstract partial class BaseViewModel : ObservableObject
{
    /// <summary>True while the page fetches what it shows for the first time (later loads keep what's on screen).</summary>
    [ObservableProperty]
    public partial bool IsLoading { get; set; }

    /// <summary>Why the page couldn't load (offline, the API refused), shown in place of its content; null when it did.</summary>
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasError))]
    public partial string? Error { get; set; }

    public bool HasError => Error != null;

    /// <summary>Called every time the page appears; reload state here.</summary>
    public virtual Task OnAppearingAsync() => Task.CompletedTask;

    public virtual void OnDisappearing()
    {
    }

    /// <summary>Pulling the tab down: fetches everything again.</summary>
    public virtual Task RefreshAsync() => OnAppearingAsync();

    protected static Task GoTo(string route) => Shell.Current.GoToAsync(route);

    protected static Task GoBack() => Shell.Current.GoToAsync("..");

    /// <summary>
    /// The first time, shows what's saved on the device at once (<paramref name="cached"/>, when there is anything), then
    /// what the server says (or the saved copy again, offline: see StudyData). The spinner and error only show while
    /// there's nothing at all to show.
    /// </summary>
    protected async Task LoadAsync<T>(Func<T?> cached, Func<Task<T>> fetch, Action<T> show, bool firstTime) where T : class
    {
        var shown = false;
        if (firstTime && cached() is { } saved)
        {
            show(saved);
            shown = true;
        }
        await LoadAsync(async () => show(await fetch()), firstTime && !shown);
    }

    /// <summary>
    /// Runs a load, showing the spinner only while there's nothing yet (<paramref name="firstTime"/>) and the error in
    /// place of the content when it fails with nothing to show.
    /// </summary>
    protected async Task LoadAsync(Func<Task> load, bool firstTime)
    {
        if (firstTime)
            IsLoading = true;
        try
        {
            await load();
            Error = null;
        }
        catch (Exception e)
        {
            if (firstTime)
                Error = e is Services.ApiException ? e.Message : "Couldn't load this. Pull down to try again.";
        }
        finally
        {
            IsLoading = false;
        }
    }
}
