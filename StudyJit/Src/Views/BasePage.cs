using StudyJit.ViewModels;

namespace StudyJit.Views;

/// <summary>Forwards page lifecycle events to the page's view model, and eases the page's content in the first time it shows.</summary>
public class BasePage : ContentPage
{
    bool _entered;

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        if (!_entered && Content is { } content)
        {
            _entered = true;
            content.Opacity = 0;
            content.TranslationY = 14;
            _ = Task.WhenAll(content.FadeToAsync(1, 240, Easing.CubicOut), content.TranslateToAsync(0, 0, 320, Easing.CubicOut));
        }
        if (BindingContext is BaseViewModel vm)
            await vm.OnAppearingAsync();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        (BindingContext as BaseViewModel)?.OnDisappearing();
    }
}
