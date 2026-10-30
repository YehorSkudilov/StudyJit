using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class SignInPage : ContentPage
{
    public SignInPage(SignInViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
        viewModel.SignedIn += async (_, _) =>
        {
            await Navigation.PopModalAsync();
            MainPage.ReloadAll();
        };
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ((SignInViewModel)BindingContext).OnAppearingAsync();
    }

    // Signing in is the only way on.
    protected override bool OnBackButtonPressed() => true;
}
