using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class CoursePage : BasePage
{
    public CoursePage(CourseViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
