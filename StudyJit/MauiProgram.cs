using AppSkeleton;
using StudyJit.Services;
using StudyJit.ViewModels;
using StudyJit.Views;
using StudyJit.Views.Study;
using Microsoft.Extensions.Logging;

namespace StudyJit;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .UseAppSkeleton()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
                fonts.AddCIcons();
            });

        builder.Services.AddSingleton<AuthSession>();
        builder.Services.AddSingleton(sp => new ApiClient(ApiConfig.CreateClient(), sp.GetRequiredService<AuthSession>()));
        builder.Services.AddSingleton<DialogService>();

        builder.Services.AddTransient<MainPage>();
        AddPage<HomePage, HomeViewModel>(builder.Services);
        AddPage<CoursesPage, CoursesViewModel>(builder.Services);
        AddPage<LibraryPage, LibraryViewModel>(builder.Services);
        AddPage<ProfilePage, ProfileViewModel>(builder.Services);
        AddPage<CoursePage, CourseViewModel>(builder.Services);
        AddPage<NewCoursePage, NewCourseViewModel>(builder.Services);
        AddPage<SetPage, SetViewModel>(builder.Services);
        AddPage<NewExamPage, NewExamViewModel>(builder.Services);
        AddPage<AccountPage, AccountViewModel>(builder.Services);
        AddPage<SignInPage, SignInViewModel>(builder.Services);
        builder.Services.AddTransient<StudyPage>();

        // Every button gives a little under the finger and springs back, so taps feel alive.
        Microsoft.Maui.Handlers.ButtonHandler.Mapper.AppendToMapping("PressAnimation", (_, view) =>
        {
            if (view is not Button button)
                return;
            button.Pressed -= OnButtonPressed;
            button.Released -= OnButtonReleased;
            button.Pressed += OnButtonPressed;
            button.Released += OnButtonReleased;
        });

#if ANDROID
        // MAUI gives every Border its own hardware layer, an offscreen copy redrawn whenever anything inside it changes;
        // the rounded clip doesn't need one (it's a clip path on the canvas). As in Gym Book.
        Microsoft.Maui.Handlers.BorderHandler.Mapper.AppendToMapping("NoHardwareLayer", (handler, _) =>
            handler.PlatformView?.SetLayerType(Android.Views.LayerType.None, null));
#endif

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }

    static void OnButtonPressed(object? sender, EventArgs e)
    {
        if (sender is Button button)
        {
            button.AbortAnimation("ScaleTo");
            _ = button.ScaleToAsync(0.95, 90, Easing.CubicOut);
        }
    }

    static void OnButtonReleased(object? sender, EventArgs e)
    {
        if (sender is Button button)
            _ = button.ScaleToAsync(1, 260, Easing.SpringOut);
    }

    static void AddPage<TPage, TViewModel>(IServiceCollection services)
        where TPage : Element
        where TViewModel : class
    {
        services.AddTransient<TPage>();
        services.AddTransient<TViewModel>();
    }
}
