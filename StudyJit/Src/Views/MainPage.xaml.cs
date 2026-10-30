using System.Collections.ObjectModel;
using AppSkeleton;

namespace StudyJit.Views;

/// <summary>The tabs, in the order they sit in the nav bar (and swipe).</summary>
public enum AppTab { Home, Courses, Library, Profile }

/// <summary>The app's root: the tabs live in a swipeable CView with a CNavBar underneath. Detail pages still push through Shell.</summary>
public partial class MainPage : ContentPage
{
    static WeakReference<MainPage>? _instance;

    readonly ObservableCollection<CNavItem> _tabs;
    CNavItem? _current;
    bool _visible;

    public MainPage(HomePage home, CoursesPage courses, LibraryPage library, ProfilePage profile)
    {
        InitializeComponent();

        var color = (Color)Application.Current!.Resources["TextPrimary"];
        // In AppTab order. Icons with a solid body, so the filled version (selected) looks different from the outline one.
        _tabs =
        [
            new() { Glyph = "home", PageName = "Home", Page = home, Color = color },
            new() { Glyph = "school", PageName = "Courses", Page = courses, Color = color },
            new() { Glyph = "collections_bookmark", PageName = "Library", Page = library, Color = color },
            new() { Glyph = "person", PageName = "Profile", Page = profile, Color = color },
        ];

        TabContent.CNavIconItems = _tabs;
        TabContent.PropertyChanged += OnTabContentChanged;
        NavBar.LoadPageCommand = new Command<CNavItem>(Show);
        NavBar.CNavIconItems = _tabs;
        NavBar.SelectItem(_tabs[(int)AppTab.Home]);

        _instance = new(this);

#if ANDROID
        // Android's own pull-to-refresh (SwipeRefreshLayout) shows its spinner the moment it takes the touch, with no way
        // to hide it; CView tells the pull instead, the way it tells the swipe between tabs, and RefreshIndicator shows it.
        PageRefreshView.HandlerChanged += (_, _) =>
        {
            if (PageRefreshView.Handler?.PlatformView is AndroidX.SwipeRefreshLayout.Widget.SwipeRefreshLayout layout)
                layout.Enabled = false;
        };
        TabContent.PullProgressChanged += OnPullProgressChanged;
        TabContent.PullCommitted += OnPullCommitted;
        TabContent.PullCancelled += (_, _) => HideIndicatorAtOnce();
#endif
    }

    // ---------- Pull to refresh (as in Gym Book's tabs) ----------

    // Shown at least this long, so a refresh that's done at once doesn't just flash.
    static readonly TimeSpan MinRefreshTime = TimeSpan.FromMilliseconds(600);
    bool _refreshing, _spinning;

    /// <summary>The tab on screen fetches everything again. A failure leaves the tab as it was; the indicator always goes.</summary>
    async Task RefreshCurrentAsync()
    {
        var started = DateTime.UtcNow;
        try
        {
            if (_current?.Page is TabView tab)
                await tab.RefreshAsync();
        }
        catch (Exception)
        {
            // Offline: what's shown stays.
        }
        finally
        {
            var elapsed = DateTime.UtcNow - started;
            if (elapsed < MinRefreshTime)
                await Task.Delay(MinRefreshTime - elapsed);
        }
    }

    // iOS, Mac and Windows: RefreshView's own pull.
    async void OnPageRefreshing(object? sender, EventArgs e)
    {
        if (_refreshing)
            return;
        _refreshing = true;
        await RefreshCurrentAsync();
        PageRefreshView.IsRefreshing = false;
        _refreshing = false;
    }

#if ANDROID
    // The arrow follows the finger down and turns over (pointing up) exactly as the pull is far enough to let go.
    void OnPullProgressChanged(object? sender, double progress)
    {
        if (_refreshing)
            return;
        var p = Math.Clamp(progress, 0, 1);
        RefreshIndicator.IsVisible = p > 0;
        RefreshIndicator.TranslationY = -80 + 80 * p;
        RefreshIndicator.Opacity = p;
        RefreshArrow.Rotation = p * 180;
    }

    async void OnPullCommitted(object? sender, EventArgs e)
    {
        if (_refreshing)
            return;
        _refreshing = true;
        RefreshIndicator.IsVisible = true;
        RefreshIndicator.TranslationY = 0;
        RefreshIndicator.Opacity = 1;
        StartSpin();
        await RefreshCurrentAsync();
        _spinning = false;
        await Task.WhenAll(
            RefreshIndicator.TranslateToAsync(0, -80, 220, Easing.CubicIn),
            RefreshIndicator.FadeToAsync(0, 220, Easing.CubicIn));
        _refreshing = false;
        HideIndicatorAtOnce();
    }

    // Whole turns, checked between them, so stopping lets the one under way finish instead of snapping.
    async void StartSpin()
    {
        if (_spinning)
            return;
        _spinning = true;
        while (_spinning)
            await RefreshArrow.RotateToAsync(RefreshArrow.Rotation + 360, 700, Easing.Linear);
    }
#endif

    void HideIndicatorAtOnce()
    {
        if (_refreshing)
            return;
        RefreshIndicator.IsVisible = false;
        RefreshIndicator.TranslationY = -80;
        RefreshIndicator.Opacity = 0;
        RefreshArrow.Rotation = 0;
    }

    /// <summary>Pops back to the root and switches to <paramref name="tab"/>.</summary>
    public static async Task ShowTab(AppTab tab)
    {
        await Shell.Current.GoToAsync("//main");
        if (_instance?.TryGetTarget(out var page) == true)
            page.NavBar.SelectItem(page._tabs[(int)tab]);
    }

    /// <summary>
    /// Every tab fetches again (signed in as someone else, or signed out); the one on screen at once, the others when
    /// they're next shown.
    /// </summary>
    public static void ReloadAll()
    {
        if (_instance?.TryGetTarget(out var page) == true && page._visible)
            page._current?.Page.Load();
    }

    void Show(CNavItem item)
    {
        if (item == _current)
            return;
        if (_visible)
            _current?.Page.Unload();
        _current = item;
        TabContent.SetContent(item);
        if (!_visible)
            return;
        // The tab refreshes once it has slid in, not while it slides, so the switch doesn't stutter.
        if (TabContent.IsNavigating)
            _loadAfterSlide = item;
        else
            item.Page.Load();
    }

    CNavItem? _loadAfterSlide;

    void OnTabContentChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName != nameof(CView.IsNavigating) || TabContent.IsNavigating || _loadAfterSlide is not { } item)
            return;
        _loadAfterSlide = null;
        if (_visible && item == _current)
            item.Page.Load();
    }

    // Tabs only count as visible while this page is on top: returning from a detail page reloads the current tab.
    protected override void OnAppearing()
    {
        base.OnAppearing();
        _visible = true;
        _loadAfterSlide = null;
        foreach (var tab in _tabs)
            ((TabView)tab.Page).BottomInset = 20;
        _current?.Page.Load();
        PreloadTabs();
    }

    bool _preloaded;

    // Every tab makes its views once, soon after the app opens, so the first time each is opened it's already there
    // instead of building as it slides in. One at a time with a pause between, so the tab on screen keeps moving smoothly.
    async void PreloadTabs()
    {
        if (_preloaded)
            return;
        _preloaded = true;
        await Task.Delay(800);
        foreach (var tab in _tabs)
        {
            if (!_visible)
                return;
            if (tab == _current)
                continue;
            TabContent.Preload(tab.Page);
            await Task.Delay(250);
        }
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        _visible = false;
        _current?.Page.Unload();
    }
}
