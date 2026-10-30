using StudyJit.ViewModels;

namespace StudyJit.Views;

public partial class AccountPage : BasePage
{
    public AccountPage(AccountViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
