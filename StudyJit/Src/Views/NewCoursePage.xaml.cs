using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class NewCoursePage : BasePage
{
    public NewCoursePage(NewCourseViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
