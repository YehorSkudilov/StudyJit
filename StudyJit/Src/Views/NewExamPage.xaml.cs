using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class NewExamPage : BasePage
{
    public NewExamPage(NewExamViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
