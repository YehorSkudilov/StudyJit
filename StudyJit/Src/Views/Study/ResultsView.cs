using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>A question as it went, for the review under the results.</summary>
public record ReviewRow(string Prompt, string Answer, string? Given, bool Correct, string? Explanation);

/// <summary>The end of a round (the website's Results): the score in a ring, a word on it, what was missed and why, and what next.</summary>
public class ResultsView : ContentView
{
    public ResultsView(int right, int total, IReadOnlyList<ReviewRow> review, IEnumerable<(string Text, Action Action, bool Primary)> actions, string? note = null)
    {
        var percent = total == 0 ? 0 : (int)Math.Round(100.0 * right / total);
        var color = percent >= 80 ? "Success" : percent >= 50 ? "Warning" : "Danger";
        var ring = new Border
        {
            WidthRequest = 132, HeightRequest = 132, StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 66 },
            StrokeThickness = 8, Stroke = Ui.Color(color), HorizontalOptions = LayoutOptions.Center,
            Content = new VerticalStackLayout
            {
                VerticalOptions = LayoutOptions.Center,
                Children =
                {
                    Ui.Text($"{percent}%", 34, bold: true, align: TextAlignment.Center),
                    Ui.Caption($"{right} of {total}", TextAlignment.Center),
                },
            },
        };
        ring.Scale = 0.6;
        _ = ring.ScaleToAsync(1, 500, Easing.SpringOut);

        var stack = new VerticalStackLayout { Spacing = 14 };
        stack.Children.Add(ring);
        stack.Children.Add(Ui.Text(percent switch
        {
            100 => "Perfect score!",
            >= 80 => "Great work!",
            >= 50 => "Getting there",
            _ => "Keep practising",
        }, 22, bold: true, align: TextAlignment.Center));
        if (note != null)
            stack.Children.Add(Ui.Caption(note, TextAlignment.Center));
        foreach (var (text, action, primary) in actions)
            stack.Children.Add(primary ? Ui.Primary(text, action) : Ui.Secondary(text, action));

        if (Misses(review) is { } misses)
            stack.Children.Add(misses);
        Content = stack;
    }

    /// <summary>What was missed, each with the right answer and why; null when nothing was.</summary>
    public static View? Misses(IReadOnlyList<ReviewRow> review)
    {
        var missed = review.Where(r => !r.Correct).ToList();
        if (missed.Count == 0)
            return null;
        var stack = new VerticalStackLayout { Spacing = 14 };
        stack.Children.Add(new Label { Text = $"TO REVIEW ({missed.Count})", Style = Ui.Style("Overline"), Margin = new(4, 10, 0, 0) });
        foreach (var row in missed)
        {
            var card = Ui.Stack(6, Ui.Text(row.Prompt, 15, bold: true));
            if (!string.IsNullOrWhiteSpace(row.Given))
                card.Children.Add(Ui.Text($"Your answer: {row.Given}", 14, "Danger"));
            card.Children.Add(Ui.Text($"Answer: {row.Answer}", 14, "Success"));
            if (!string.IsNullOrWhiteSpace(row.Explanation))
                card.Children.Add(Ui.Caption(row.Explanation));
            stack.Children.Add(Ui.Card(card, 14));
        }
        return stack;
    }

    /// <summary>The review row for a study item and what was given.</summary>
    public static ReviewRow Row(StudyItem item, string? given) =>
        new(item.Statement ?? item.Prompt, item.Answer, given, StudyItems.IsRight(item, given), item.Explanation);
}
