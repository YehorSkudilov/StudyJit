using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>
/// One question on screen (the website's ItemView and Feedback): choices to tap, True / False, or a box to type in.
/// With feedback (Practice, Learn, Write) the answer is checked at once and shown with the right one and why, then
/// Continue; without (Test) the answer can be changed until the test is handed in.
/// </summary>
public class ItemCard : ContentView
{
    readonly StudyItem _item;
    readonly bool _feedback;
    readonly VerticalStackLayout _root;
    readonly List<(Button Button, string Value)> _choices = [];
    Entry? _entry;

    /// <summary>The answer given so far (a choice, "True"/"False", or what's typed); null before any.</summary>
    public string? Given { get; private set; }

    public bool IsAnswered => Given != null;

    /// <summary>Answered (with feedback: checked; without: picked or changed). The argument is whether it's right.</summary>
    public event EventHandler<bool>? Answered;

    /// <summary>Continue tapped under the feedback.</summary>
    public event EventHandler? Continued;

    /// <summary>"I was right": a typed answer the checker didn't accept, that the student says was right.</summary>
    public event EventHandler? Overridden;

    public ItemCard(StudyItem item, bool feedback, int? number = null)
    {
        _item = item;
        _feedback = feedback;
        _root = new VerticalStackLayout { Spacing = 12 };
        var label = number is { } n ? $"QUESTION {n}" : item.Label?.ToUpperInvariant();
        if (label != null)
            _root.Children.Add(Ui.Overline(label));
        _root.Children.Add(Ui.Text(item.Prompt, item.Kind == ItemKind.TrueFalse ? 15 : 19, item.Kind == ItemKind.TrueFalse ? "TextSecondary" : "TextPrimary", bold: true));
        if (item.Statement is { } statement)
            _root.Children.Add(Ui.Card(Ui.Text(statement, 18), 18, "Surface2"));

        switch (item.Kind)
        {
            case ItemKind.Choice:
                foreach (var option in item.Options)
                    AddChoice(option, option);
                break;
            case ItemKind.TrueFalse:
                var pair = new Grid { ColumnDefinitions = [new(GridLength.Star), new(GridLength.Star)], ColumnSpacing = 10 };
                pair.Add(MakeChoice("True", "True"), 0);
                pair.Add(MakeChoice("False", "False"), 1);
                _root.Children.Add(pair);
                break;
            default:
                _entry = new Entry { Placeholder = "Type your answer", ReturnType = ReturnType.Done };
                var box = new Border { Style = Ui.Style("InputBox"), HeightRequest = 52, Padding = new(12, 0), Content = _entry };
                _root.Children.Add(box);
                if (feedback)
                {
                    _entry.Completed += (_, _) => Check();
                    _root.Children.Add(Ui.Primary("Check", Check));
                    _root.Children.Add(Ui.Ghost("I don't know", () => { _entry.Text = ""; Submit("—"); }));
                }
                else
                {
                    _entry.TextChanged += (_, e) =>
                    {
                        Given = string.IsNullOrWhiteSpace(e.NewTextValue) ? null : e.NewTextValue;
                        Answered?.Invoke(this, StudyItems.IsRight(_item, Given));
                    };
                }
                break;
        }
        Content = _root;
    }

    /// <summary>Puts the cursor in the answer box, for typed questions.</summary>
    public void FocusEntry() => _entry?.Focus();

    void AddChoice(string text, string value) => _root.Children.Add(MakeChoice(text, value));

    Button MakeChoice(string text, string value)
    {
        var button = new Button { Text = text, Style = Ui.Style("ChoiceButton") };
        if (_item.Kind == ItemKind.TrueFalse)
            button.FontFamily = "OpenSansSemibold";
        button.Clicked += (_, _) => Submit(value);
        _choices.Add((button, value));
        return button;
    }

    void Check()
    {
        if (string.IsNullOrWhiteSpace(_entry?.Text))
            return;
        Submit(_entry.Text.Trim());
    }

    void Submit(string given)
    {
        if (_feedback && IsAnswered)
            return;
        Given = given;
        var right = StudyItems.IsRight(_item, given);
        if (!_feedback)
        {
            // Test: just mark what's picked; it can still change.
            foreach (var (button, value) in _choices)
                button.BorderColor = value == given ? Ui.Color("Accent") : Ui.Color("Stroke");
            Answered?.Invoke(this, right);
            return;
        }
        Ui.Buzz(right);
        foreach (var (button, value) in _choices)
        {
            var isAnswer = string.Equals(value, _item.Answer, StringComparison.OrdinalIgnoreCase);
            if (isAnswer)
                (button.BackgroundColor, button.BorderColor) = (Ui.Color("SuccessSoft"), Ui.Color("Success"));
            else if (value == given)
                (button.BackgroundColor, button.BorderColor) = (Ui.Color("DangerSoft"), Ui.Color("Danger"));
            else
                button.Opacity = 0.5;
            button.IsEnabled = false;
        }
        if (_entry != null)
            _entry.IsReadOnly = true;
        // The typed-answer buttons (Check, I don't know) give way to the feedback.
        foreach (var b in _root.Children.OfType<Button>().Where(b => !_choices.Any(c => c.Button == b)).ToList())
            _root.Children.Remove(b);
        _root.Children.Add(Feedback(right));
        Answered?.Invoke(this, right);
    }

    View Feedback(bool right)
    {
        var stack = new VerticalStackLayout { Spacing = 8 };
        var title = new HorizontalStackLayout { Spacing = 8 };
        title.Children.Add(Ui.Icon(right ? "check_circle" : "cancel", 22, right ? "Success" : "Danger"));
        title.Children.Add(Ui.Text(right ? Praise() : "Not quite", 17, right ? "Success" : "Danger", bold: true));
        stack.Children.Add(title);
        if (!right)
        {
            stack.Children.Add(Ui.Text($"Answer: {_item.Answer}", 15, bold: true));
            if (_item.Kind == ItemKind.Written && Given != "—")
                stack.Children.Add(Ui.Caption($"You wrote: {Given}"));
        }
        if (!string.IsNullOrWhiteSpace(_item.Explanation))
            stack.Children.Add(Ui.Caption(_item.Explanation));
        if (!right && _item.Kind == ItemKind.Written && Given != "—")
        {
            Button? overrideButton = null;
            overrideButton = Ui.Ghost("I was right", () =>
            {
                stack.Children.Remove(overrideButton);
                ((Label)title.Children[1]).Text = "Counted as right";
                Overridden?.Invoke(this, EventArgs.Empty);
            });
            overrideButton.HorizontalOptions = LayoutOptions.Start;
            stack.Children.Add(overrideButton);
        }
        var next = Ui.Primary("Continue", () => Continued?.Invoke(this, EventArgs.Empty));
        next.Margin = new(0, 6, 0, 0);
        stack.Children.Add(next);
        var card = Ui.Card(stack, 16, right ? "SuccessSoft" : "DangerSoft");
        card.Opacity = 0;
        _ = card.FadeToAsync(1, 200);
        return card;
    }

    static readonly string[] Praises = ["Correct!", "Nice!", "Spot on!", "Exactly!", "You got it!"];

    static string Praise() => Praises[Random.Shared.Next(Praises.Length)];
}
