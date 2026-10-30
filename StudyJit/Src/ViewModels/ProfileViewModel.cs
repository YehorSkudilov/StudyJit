using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Services;

namespace StudyJit.ViewModels;

/// <summary>The Profile tab: the account, links to the website, the app's version, signing out.</summary>
public partial class ProfileViewModel(ApiClient api, AuthSession session, DialogService dialogs) : BaseViewModel
{
    [ObservableProperty]
    public partial string Name { get; set; } = "";

    [ObservableProperty]
    public partial string Email { get; set; } = "";

    [ObservableProperty]
    public partial string Initials { get; set; } = "";

    public string Version => $"StudyJit {AppInfo.Current.VersionString} ({AppInfo.Current.BuildString})";

    public bool HasWebsite => ApiConfig.WebAddress != null;

    public override Task OnAppearingAsync()
    {
        Name = session.Name ?? "";
        Email = session.Email ?? "";
        Initials = string.Concat(Name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2).Select(w => char.ToUpperInvariant(w[0])));
        return Task.CompletedTask;
    }

    [RelayCommand]
    Task EditAccount() => GoTo(Routes.Account);

    [RelayCommand]
    Task OpenWebsite(string path) =>
        ApiConfig.WebAddress is { } web ? Browser.Default.OpenAsync(new Uri(web, path), BrowserLaunchMode.SystemPreferred) : Task.CompletedTask;

    [RelayCommand]
    async Task SignOut()
    {
        if (!await dialogs.Confirm("Sign out?", "Your courses and study sets stay in your account.", "Sign out"))
            return;
        await api.SignOutAsync();
    }
}
