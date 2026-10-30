namespace StudyJit.Views.Study;

/// <summary>The app's looks (Resources/Styles) for the study modes, which build their screens in code as they go.</summary>
static class Ui
{
    public static Color Color(string key) => (Color)Application.Current!.Resources[key];

    public static Style Style(string key) => (Style)Application.Current!.Resources[key];

    public static Label Text(string text, double size = 15, string color = "TextPrimary", bool bold = false, TextAlignment align = TextAlignment.Start) => new()
    {
        Text = text,
        FontSize = size,
        TextColor = Color(color),
        FontFamily = bold ? "OpenSansSemibold" : "OpenSansRegular",
        HorizontalTextAlignment = align,
        LineBreakMode = LineBreakMode.WordWrap,
    };

    public static Label Caption(string text, TextAlignment align = TextAlignment.Start) => Text(text, 13, "TextSecondary", align: align);

    public static Label Overline(string text) => new() { Text = text, Style = Style("Overline") };

    public static Label Icon(string glyph, double size, string color) => new()
    {
        Text = glyph,
        FontFamily = "OutlinedIcons",
        FontSize = size,
        TextColor = Color(color),
        HorizontalOptions = LayoutOptions.Center,
        VerticalOptions = LayoutOptions.Center,
    };

    public static Button Primary(string text, Action onClick) => Wire(new Button { Text = text, Style = Style("PrimaryButton") }, onClick);

    public static Button Secondary(string text, Action onClick) => Wire(new Button { Text = text, Style = Style("SecondaryButton") }, onClick);

    public static Button Ghost(string text, Action onClick) => Wire(new Button { Text = text, Style = Style("GhostButton") }, onClick);

    static Button Wire(Button button, Action onClick)
    {
        button.Clicked += (_, _) => onClick();
        return button;
    }

    public static Border Card(View content, double padding = 16, string background = "Surface") => new()
    {
        Style = Style("Card"),
        BackgroundColor = Color(background),
        Padding = padding,
        Content = content,
    };

    public static VerticalStackLayout Stack(double spacing, params View[] children)
    {
        var stack = new VerticalStackLayout { Spacing = spacing };
        foreach (var child in children)
            stack.Children.Add(child);
        return stack;
    }

    /// <summary>Two buttons side by side, equal width.</summary>
    public static Grid Pair(View left, View right)
    {
        var grid = new Grid { ColumnDefinitions = [new(GridLength.Star), new(GridLength.Star)], ColumnSpacing = 10 };
        grid.Add(left, 0);
        grid.Add(right, 1);
        return grid;
    }

    /// <summary>A small vibration for a right or wrong answer, where the device has one.</summary>
    public static void Buzz(bool right)
    {
        try
        {
            if (right)
                HapticFeedback.Default.Perform(HapticFeedbackType.Click);
            else
                HapticFeedback.Default.Perform(HapticFeedbackType.LongPress);
        }
        catch (Exception)
        {
            // No haptics here (desktop): nothing to feel.
        }
    }
}
