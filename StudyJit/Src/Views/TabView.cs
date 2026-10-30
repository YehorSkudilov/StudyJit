using AppSkeleton;
using StudyJit.ViewModels;

namespace StudyJit.Views;

/// <summary>
/// A tab hosted in <see cref="MainPage"/>'s CView; forwards tab lifecycle to the view model.
/// Tabs are written as plain content: this wraps it in its own ScrollView with the page padding, so each tab keeps
/// its own scroll position. Tabs whose content scrolls by itself (a CollectionView) set <see cref="ScrollsItself"/>
/// and only get the padding; they use <see cref="BottomInset"/> to keep their last items clear of the nav bar.
/// </summary>
public class TabView : PageBase
{
    // Sides line up with the nav bar (inset 10 in MainPage); top and bottom keep more room.
    const double SideGutter = 10, Gutter = 20;

    public static readonly BindableProperty ScrollsItselfProperty =
        BindableProperty.Create(nameof(ScrollsItself), typeof(bool), typeof(TabView), false);

    /// <summary>Extra space at the bottom for whatever floats over the tabs (nothing yet; the nav bar is already allowed for). Set by MainPage.</summary>
    public static readonly BindableProperty BottomInsetProperty =
        BindableProperty.Create(nameof(BottomInset), typeof(double), typeof(TabView), 0.0,
            propertyChanged: (b, _, _) => ((TabView)b).ApplyPadding());

    ScrollView? _scroll;

    public TabView()
    {
        UpdateTemplate();
    }

    public bool ScrollsItself
    {
        get => (bool)GetValue(ScrollsItselfProperty);
        set => SetValue(ScrollsItselfProperty, value);
    }

    public double BottomInset
    {
        get => (double)GetValue(BottomInsetProperty);
        set => SetValue(BottomInsetProperty, value);
    }

    protected override void OnPropertyChanged(string? propertyName = null)
    {
        base.OnPropertyChanged(propertyName);
        if (propertyName == nameof(ScrollsItself))
            UpdateTemplate();
    }

    // The ScrollView goes in through a ControlTemplate instead of by swapping Content: replacing Content from inside
    // its own change notification runs before ContentView re-parents it and hangs the app building the view tree.
    void UpdateTemplate()
    {
        _scroll = null;
        ControlTemplate = ScrollsItself
            ? null
            : new ControlTemplate(() =>
            {
                _scroll = new ScrollView { Content = new ContentPresenter() };
                ApplyPadding();
                return _scroll;
            });
        ApplyPadding();
    }

    void ApplyPadding()
    {
        if (_scroll != null)
        {
            // Padding inside the scroll view, so content scrolls to the edges and clears the nav bar at the end.
            Padding = 0;
            _scroll.Padding = new Thickness(SideGutter, Gutter, SideGutter, Gutter + BottomInset);
        }
        else
        {
            // Self-scrolling content runs to the bottom edge; it adds BottomInset inside its own list.
            Padding = new Thickness(SideGutter, Gutter, SideGutter, 0);
        }
    }

    /// <summary>How far the tab is scrolled down (0 for a tab that scrolls itself).</summary>
    public double ScrollY => _scroll?.ScrollY ?? 0;

    /// <summary>
    /// Scrolls the tab back to <paramref name="y"/> once its content is tall enough to (it fills in as it loads), giving
    /// up after a couple of seconds.
    /// </summary>
    public async Task RestoreScrollAsync(double y)
    {
        if (_scroll == null || y <= 0)
            return;
        for (var i = 0; i < 20 && _scroll.ContentSize.Height < y + _scroll.Height; i++)
            await Task.Delay(100);
        await _scroll.ScrollToAsync(0, y, false);
    }

    public override async void Load()
    {
        if (BindingContext is BaseViewModel vm)
            await vm.OnAppearingAsync();
    }

    public override void Unload() => (BindingContext as BaseViewModel)?.OnDisappearing();

    /// <summary>Pulled down (see MainPage): the tab fetches everything again.</summary>
    public override Task RefreshAsync() => (BindingContext as BaseViewModel)?.RefreshAsync() ?? Task.CompletedTask;
}
