namespace StudyJit.Services;

/// <summary>Alerts, confirmations, prompts and choices, over whatever page is on top.</summary>
public class DialogService
{
    static Page Top
    {
        get
        {
            var root = Application.Current!.Windows[0].Page!;
            return root.Navigation.ModalStack.LastOrDefault() ?? (Shell.Current?.CurrentPage ?? root);
        }
    }

    public Task Alert(string title, string message, string ok = "OK") =>
        MainThread.InvokeOnMainThreadAsync(() => Top.DisplayAlertAsync(title, message, ok));

    public Task<bool> Confirm(string title, string message, string accept = "OK", string cancel = "Cancel") =>
        MainThread.InvokeOnMainThreadAsync(() => Top.DisplayAlertAsync(title, message, accept, cancel));

    /// <summary>A line of text, or null when cancelled.</summary>
    public Task<string?> Prompt(string title, string message, string accept = "OK", string? initial = null, string? placeholder = null,
        Keyboard? keyboard = null) =>
        MainThread.InvokeOnMainThreadAsync(() =>
            Top.DisplayPromptAsync(title, message, accept, "Cancel", placeholder, -1, keyboard ?? Keyboard.Text, initial ?? ""));

    /// <summary>One of <paramref name="buttons"/>, or null when cancelled.</summary>
    public async Task<string?> ActionSheet(string title, string? destruction, params string[] buttons)
    {
        var choice = await MainThread.InvokeOnMainThreadAsync(() => Top.DisplayActionSheetAsync(title, "Cancel", destruction, buttons));
        return choice is null or "Cancel" ? null : choice;
    }

    /// <summary>Shows <paramref name="e"/>'s message when it's one meant for people (the API's own), else a general one.</summary>
    public Task Error(Exception e, string title = "Something went wrong") =>
        Alert(title, e is ApiException ? e.Message : "Please try again.");
}
