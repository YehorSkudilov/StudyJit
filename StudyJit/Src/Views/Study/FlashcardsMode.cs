using Microsoft.Maui.Controls.Shapes;
using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>Flashcards: the key terms, flipped with a tap and sorted into "know it" and "still learning".</summary>
public class FlashcardsMode : ModeView
{
    List<Term> _deck = [];
    readonly List<Term> _learning = [];
    int _index, _known;
    bool _definitionFirst, _flipped;
    Border _card = null!;
    Label _face = null!, _side = null!;

    protected override void Start() => Begin(StudyItems.Shuffle(Quiz.Terms));

    void Begin(List<Term> deck)
    {
        _deck = deck;
        _learning.Clear();
        _index = _known = 0;
        Build();
        ShowCard();
    }

    void Build()
    {
        _side = Ui.Overline("");
        _face = Ui.Text("", 22, bold: true, align: TextAlignment.Center);
        _face.VerticalOptions = LayoutOptions.Center;
        var hint = Ui.Caption("Tap to flip", TextAlignment.Center);
        var inner = new Grid { RowDefinitions = [new(GridLength.Auto), new(GridLength.Star), new(GridLength.Auto)], Padding = 20 };
        inner.Add(_side, 0, 0);
        inner.Add(_face, 0, 1);
        inner.Add(hint, 0, 2);
        _card = new Border
        {
            StrokeShape = new RoundRectangle { CornerRadius = 24 },
            BackgroundColor = Ui.Color("Surface"),
            Stroke = Ui.Color("Stroke"),
            StrokeThickness = 1,
            MinimumHeightRequest = 320,
            Content = inner,
        };
        _card.GestureRecognizers.Add(new TapGestureRecognizer { Command = new Command(async () => await FlipAsync()) });

        var still = Ui.Secondary("Still learning", () => _ = SortAsync(false));
        still.TextColor = Ui.Color("Warning");
        var know = Ui.Secondary("Know it", () => _ = SortAsync(true));
        know.TextColor = Ui.Color("Success");
        var swap = Ui.Ghost("Show definitions first", () => { });
        swap.Clicked += (_, _) =>
        {
            _definitionFirst = !_definitionFirst;
            swap.Text = _definitionFirst ? "Show terms first" : "Show definitions first";
            _flipped = false;
            ShowFace();
        };
        Show(Ui.Stack(14, _card, Ui.Pair(still, know), swap));
    }

    void ShowCard()
    {
        Host.SetProgress((double)_index / _deck.Count);
        Host.SetStat($"{_index + 1} / {_deck.Count}");
        _flipped = false;
        ShowFace();
    }

    void ShowFace()
    {
        var term = _deck[_index];
        var showTerm = _flipped == _definitionFirst;
        _side.Text = showTerm ? "TERM" : "DEFINITION";
        _face.Text = showTerm ? term.Name : term.Definition;
        _face.FontSize = showTerm ? 26 : 18;
        _face.FontFamily = showTerm ? "OpenSansSemibold" : "OpenSansRegular";
    }

    async Task FlipAsync()
    {
        await _card.RotateYToAsync(90, 120, Easing.CubicIn);
        _flipped = !_flipped;
        ShowFace();
        _card.RotationY = -90;
        await _card.RotateYToAsync(0, 120, Easing.CubicOut);
    }

    async Task SortAsync(bool known)
    {
        if (known)
            _known++;
        else
            _learning.Add(_deck[_index]);
        await _card.TranslateToAsync(known ? 400 : -400, 0, 180, Easing.CubicIn);
        _card.TranslationX = 0;
        _index++;
        if (_index < _deck.Count)
            ShowCard();
        else
            Finish();
    }

    void Finish()
    {
        Host.SetProgress(1);
        Host.SetStat("");
        var stack = new VerticalStackLayout { Spacing = 14 };
        stack.Children.Add(Ui.Icon(_learning.Count == 0 ? "emoji_events" : "style", 56, _learning.Count == 0 ? "Warning" : "Accent"));
        stack.Children.Add(Ui.Text(_learning.Count == 0 ? "You know them all!" : "Deck done", 24, bold: true, align: TextAlignment.Center));
        stack.Children.Add(Ui.Caption($"{_known} known · {_learning.Count} still learning", TextAlignment.Center));
        if (_learning.Count > 0)
            stack.Children.Add(Ui.Primary($"Study the {_learning.Count} still learning", () => Begin(StudyItems.Shuffle(_learning))));
        stack.Children.Add(Ui.Secondary("Start over", () => Begin(StudyItems.Shuffle(Quiz.Terms))));
        stack.Children.Add(Ui.Ghost("Back to study modes", () => _ = Host.ExitAsync()));
        Show(stack);
    }
}
