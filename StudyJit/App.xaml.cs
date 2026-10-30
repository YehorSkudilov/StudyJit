using StudyJit.Services;
using StudyJit.Services.Offline;
using StudyJit.Views;

namespace StudyJit;

public partial class App : Application
{
    readonly IServiceProvider _services;

    public App(AuthSession session, IServiceProvider services)
    {
        InitializeComponent();
        UserAppTheme = AppTheme.Dark;
        _services = services;
        // Signed out (here, or the session ended on the server): an account is needed to go on. Signed in as someone
        // else: the tabs show their courses.
        session.Changed += (_, _) => MainThread.BeginInvokeOnMainThread(() =>
        {
            if (IsLoading)
                return;
            Views.MainPage.ReloadAll();
            _ = SignInGate.ShowIfNeededAsync(_services);
        });
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        // The loading screen first; the app is built behind it and takes its place (ShowAppAsync).
        var window = new Window(new LoadingPage()) { Title = "StudyJit" };
#if WINDOWS
        // The layout is designed for phones; open desktop builds at a phone-like size.
        window.Width = 440;
        window.Height = 780;
#endif
        window.Created += (_, _) => _ = ShowAppAsync(window);
        window.Resumed += (_, _) =>
        {
            // Still loading: the sign-in sheet comes once the app is up (ShowAppAsync), not over the loading screen.
            if (window.Page is LoadingPage)
                return;
            // Back after a while: what was studied offline goes up, and anything new comes down.
            _services.GetRequiredService<SyncService>().Schedule(TimeSpan.FromSeconds(1), download: true);
            _ = SignInGate.ShowIfNeededAsync(_services);
        };
        // Anything not sent yet is sent before the app can be closed in the background.
        window.Stopped += (_, _) => _services.GetRequiredService<SyncService>().Schedule(TimeSpan.Zero);
        return window;
    }

    /// <summary>
    /// The app in place of the loading screen: the shell, built while the loading screen stays up, so it only shows once
    /// it's ready; then the sign-in sheet over it if there's no session.
    /// </summary>
    async Task ShowAppAsync(Window window)
    {
        var shown = Task.Delay(LoadingPage.MinShown);
        await _services.GetRequiredService<AuthSession>().EnsureLoadedAsync();
        // A frame for the loading screen to come up before the shell is built (that takes a moment on the UI thread).
        await Task.Delay(50);
        var shell = new AppShell();
        await shown;
        if (window.Page is LoadingPage loading)
        {
            await loading.FadeOutAsync();
            window.Page = shell;
        }
        _ = SignInGate.ShowIfNeededAsync(_services);
        // What was studied offline goes up, and everything for studying offline comes down.
        _services.GetRequiredService<SyncService>().Schedule(TimeSpan.Zero, download: true);
    }

    /// <summary>True while the loading screen is up: nothing goes on top of it, and nothing replaces it but the app.</summary>
    static bool IsLoading => Current?.Windows.FirstOrDefault()?.Page is LoadingPage;
}
