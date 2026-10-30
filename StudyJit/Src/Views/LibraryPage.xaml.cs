using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class LibraryPage : TabView
{
    public LibraryPage(LibraryViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
