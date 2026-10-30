using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.ViewModels;

/// <summary>Profile › Account: name, email and bio, and changing the password (which signs out other devices).</summary>
public partial class AccountViewModel(ApiClient api, AuthSession session, DialogService dialogs) : BaseViewModel
{
    bool _loaded;

    [ObservableProperty]
    public partial string Name { get; set; } = "";

    [ObservableProperty]
    public partial string Email { get; set; } = "";

    [ObservableProperty]
    public partial string Bio { get; set; } = "";

    [ObservableProperty]
    public partial string CurrentPassword { get; set; } = "";

    [ObservableProperty]
    public partial string NewPassword { get; set; } = "";

    [ObservableProperty]
    public partial bool IsSaving { get; set; }

    public override async Task OnAppearingAsync()
    {
        if (_loaded)
            return;
        await LoadAsync(async () =>
        {
            var profile = await api.ProfileAsync();
            (Name, Email, Bio) = (profile.Name, profile.Email, profile.Bio ?? "");
            _loaded = true;
        }, true);
    }

    [RelayCommand]
    async Task Save()
    {
        if (string.IsNullOrWhiteSpace(Name) || string.IsNullOrWhiteSpace(Email))
        {
            await dialogs.Alert("Name and email", "Both are needed.");
            return;
        }
        var changingPassword = NewPassword.Length > 0;
        if (changingPassword && CurrentPassword.Length == 0)
        {
            await dialogs.Alert("Current password", "Enter your current password to set a new one.");
            return;
        }
        IsSaving = true;
        try
        {
            await api.UpdateProfileAsync(new UpdateProfileRequest(Name.Trim(), Email.Trim(), Bio,
                changingPassword ? CurrentPassword : null, changingPassword ? NewPassword : null));
            await session.SetProfileAsync(Name.Trim(), Email.Trim());
            CurrentPassword = NewPassword = "";
            if (changingPassword)
                await dialogs.Alert("Password changed", "Other devices signed in to your account have been signed out.");
            await GoBack();
        }
        catch (Exception e)
        {
            await dialogs.Error(e, "Couldn't save");
        }
        finally
        {
            IsSaving = false;
        }
    }
}
