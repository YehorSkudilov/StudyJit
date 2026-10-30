using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using StudyJit.Services;

namespace StudyJit.ViewModels;

/// <summary>The sign-in sheet: signing in, or creating an account when the server allows sign-up.</summary>
public partial class SignInViewModel(ApiClient api) : BaseViewModel
{
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsSignIn), nameof(Heading), nameof(ActionText), nameof(SwitchText))]
    public partial bool IsRegister { get; set; }

    public bool IsSignIn => !IsRegister;
    public string Heading => IsRegister ? "Create your account" : "Welcome back";
    public string ActionText => IsRegister ? "Create account" : "Sign in";
    public string SwitchText => IsRegister ? "Already have an account? Sign in" : "New to StudyJit? Create an account";

    [ObservableProperty]
    public partial bool SignUpEnabled { get; set; } = true;

    [ObservableProperty]
    public partial string Name { get; set; } = "";

    [ObservableProperty]
    public partial string Email { get; set; } = "";

    [ObservableProperty]
    public partial string Password { get; set; } = "";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasMessage))]
    public partial string? Message { get; set; }

    public bool HasMessage => Message != null;

    [ObservableProperty]
    public partial bool IsBusy { get; set; }

    /// <summary>Set when signing in worked; the sheet closes itself.</summary>
    public event EventHandler? SignedIn;

    public override async Task OnAppearingAsync() => SignUpEnabled = await api.SignUpEnabledAsync();

    [RelayCommand]
    void Switch()
    {
        IsRegister = !IsRegister;
        Message = null;
    }

    [RelayCommand]
    async Task Submit()
    {
        if (IsBusy)
            return;
        Message = null;
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrEmpty(Password) || (IsRegister && string.IsNullOrWhiteSpace(Name)))
        {
            Message = IsRegister ? "Enter your name, email and a password." : "Enter your email and password.";
            return;
        }
        IsBusy = true;
        try
        {
            if (IsRegister)
                await api.RegisterAsync(Name.Trim(), Email.Trim(), Password);
            else
                await api.SignInAsync(Email.Trim(), Password);
            Password = "";
            SignedIn?.Invoke(this, EventArgs.Empty);
        }
        catch (ApiException e)
        {
            Message = e.Message;
        }
        catch (Exception)
        {
            Message = "Something went wrong. Please try again.";
        }
        finally
        {
            IsBusy = false;
        }
    }
}
