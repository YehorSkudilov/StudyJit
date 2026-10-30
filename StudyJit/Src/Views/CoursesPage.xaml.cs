using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class CoursesPage : TabView
{
    public CoursesPage(CoursesViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
