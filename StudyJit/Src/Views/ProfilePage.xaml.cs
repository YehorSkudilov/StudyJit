using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class ProfilePage : TabView
{
    public ProfilePage(ProfileViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
