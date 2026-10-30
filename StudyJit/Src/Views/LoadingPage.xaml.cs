namespace StudyJit.Views;

public partial class LoadingPage : ContentPage
{
    /// <summary>Long enough for the logo to settle and the dots to breathe once, so it never just flashes.</summary>
    public static readonly TimeSpan MinShown = TimeSpan.FromMilliseconds(1100);

    public LoadingPage()
    {
        InitializeComponent();
        Loaded += (_, _) => Animate();
        Unloaded += (_, _) => this.AbortAnimation("LoadingDots");
    }

    async void Animate()
    {
        // The logo settles in, then bobs gently while the dots breathe one after another.
        _ = AppName.FadeToAsync(1, 500, Easing.CubicOut);
        await Task.WhenAll(
            Logo.FadeToAsync(1, 450, Easing.CubicOut),
            Logo.ScaleToAsync(1, 600, Easing.SpringOut));

        var dots = Dots.Children.OfType<VisualElement>().ToArray();
        new Animation(t =>
        {
            for (var i = 0; i < dots.Length; i++)
            {
                var wave = 0.5 + 0.5 * Math.Sin((t - i * 0.18) * 2 * Math.PI);
                dots[i].Opacity = 0.3 + 0.7 * wave;
                dots[i].TranslationY = -5 * wave;
            }
            Logo.TranslationY = -4 * Math.Sin(t * 2 * Math.PI);
        }).Commit(this, "LoadingDots", length: 1200, easing: Easing.Linear, repeat: () => true);
    }

    /// <summary>Fades what's on it away before the app takes its place.</summary>
    public Task FadeOutAsync() => Root.FadeToAsync(0, 180, Easing.CubicIn);
}
