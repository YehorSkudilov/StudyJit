using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class HomePage : TabView
{
    public HomePage(HomeViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
