using StudyJit.Services;

namespace StudyJit.Views;

/// <summary>
/// StudyJit needs an account (everything lives on the server): without a session on this device, the sign-in sheet
/// goes up over whatever is showing and can't be closed until it signs in.
/// </summary>
public static class SignInGate
{
    static bool _checking;

    /// <summary>Shows the sign-in sheet when there's no session, unless it's already up. Waits while another sheet is open, so it lands on top.</summary>
    public static async Task ShowIfNeededAsync(IServiceProvider services)
    {
        if (_checking)
            return;
        _checking = true;
        try
        {
            var session = services.GetRequiredService<AuthSession>();
            await session.EnsureLoadedAsync();
            await Task.Delay(100);
            while (!session.IsSignedIn && Application.Current?.Windows.FirstOrDefault()?.Page is Shell root)
            {
                var modals = root.Navigation.ModalStack;
                if (modals.Any(p => p is SignInPage))
                    return;
                if (modals.Count == 0)
                {
                    // Out of anything opened from the account signed out of.
                    await Shell.Current.GoToAsync("//main", false);
                    await root.Navigation.PushModalAsync(services.GetRequiredService<SignInPage>());
                    return;
                }
                await Task.Delay(500);
            }
        }
        finally
        {
            _checking = false;
        }
    }
}
