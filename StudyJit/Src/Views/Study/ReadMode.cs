using System.Text;
using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>The study guide (the AI's summary and a glossary of the key terms) or the cheat sheet, as a formatted page.</summary>
public class ReadMode(bool guide) : ModeView
{
    protected override void Start()
    {
        Host.SetProgress(null);
        Host.SetStat("");
        var markdown = guide ? Guide() : Quiz.CheatSheet ?? "";
        // A WebView sizes itself to nothing inside a ScrollView, so it's given the window's height and scrolls itself.
        var web = new WebView
        {
            Source = new HtmlWebViewSource { Html = MarkdownHtml.Page(markdown) },
            HeightRequest = Math.Max(400, (Window?.Height ?? DeviceDisplay.Current.MainDisplayInfo.Height / DeviceDisplay.Current.MainDisplayInfo.Density) - 150),
            BackgroundColor = Ui.Color("Bg"),
        };
        // Links open in the browser, not in place of the page.
        web.Navigating += (_, e) =>
        {
            if (e.Url.StartsWith("http"))
            {
                e.Cancel = true;
                _ = Browser.Default.OpenAsync(e.Url, BrowserLaunchMode.SystemPreferred);
            }
        };
        Content = web;
    }

    string Guide()
    {
        var text = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(Quiz.Summary))
            text.AppendLine(Quiz.Summary).AppendLine();
        if (Quiz.Terms.Count > 0)
        {
            text.AppendLine("## Key terms").AppendLine();
            foreach (var term in Quiz.Terms)
                text.AppendLine($"**{term.Name}** — {term.Definition}").AppendLine();
        }
        return text.ToString();
    }
}
