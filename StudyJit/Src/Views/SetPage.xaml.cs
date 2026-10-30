using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class SetPage : BasePage
{
    public SetPage(SetViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
