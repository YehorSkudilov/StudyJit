using StudyJit.Models;
using StudyJit.Services;

namespace StudyJit.Views.Study;

/// <summary>Exam answers: open questions answered in sentences or code, marked by the AI against their key points.</summary>
public class AnswersMode : ModeView
{
    List<WrittenAnswer> _questions = [];
    int _index;
    readonly List<int> _scores = [];

    protected override void Start() => Begin();

    void Begin()
    {
        _questions = StudyItems.Shuffle(Quiz.WrittenAnswers);
        _index = 0;
        _scores.Clear();
        Next();
    }

    void Next()
    {
        if (_index >= _questions.Count)
        {
            Finish();
            return;
        }
        var q = _questions[_index];
        Host.SetProgress((double)_index / _questions.Count);
        Host.SetStat($"{_index + 1} / {_questions.Count}");

        var editor = new Editor
        {
            Placeholder = q.Kind == "code" ? "Write your code" : "Write your answer",
            AutoSize = EditorAutoSizeOption.TextChanges,
            MinimumHeightRequest = 180,
            FontFamily = q.Kind == "code" ? "monospace" : "OpenSansRegular",
            IsSpellCheckEnabled = q.Kind != "code",
            IsTextPredictionEnabled = q.Kind != "code",
        };
        var box = new Border { Style = Ui.Style("InputBox"), HeightRequest = -1, MinimumHeightRequest = 190, Padding = new(10, 6), Content = editor };
        var result = new VerticalStackLayout { Spacing = 12 };
        Button? mark = null;
        var skip = Ui.Ghost("Show the model answer", () => { });
        mark = Ui.Primary("Mark my answer", async () =>
        {
            if (string.IsNullOrWhiteSpace(editor.Text))
                return;
            mark!.IsEnabled = false;
            mark.Text = "Marking…";
            try
            {
                var grade = await Api.GradeWrittenAsync(q.Id, editor.Text);
                _scores.Add(grade.Score);
                editor.IsReadOnly = true;
                mark.IsVisible = skip.IsVisible = false;
                result.Children.Add(Graded(q, grade));
            }
            catch (Exception e)
            {
                mark.IsEnabled = true;
                mark.Text = "Mark my answer";
                await Dialogs.Error(e, "Couldn't mark it");
            }
        });
        skip.Clicked += (_, _) =>
        {
            _scores.Add(0);
            editor.IsReadOnly = true;
            mark.IsVisible = skip.IsVisible = false;
            result.Children.Add(ModelAnswer(q));
            result.Children.Add(ContinueButton());
        };

        Show(Ui.Stack(12,
            Ui.Overline(q.Kind == "code" ? "WRITE CODE" : "EXPLAIN"),
            Ui.Text(q.Question, 19, bold: true),
            box, mark, skip, result));
    }

    View Graded(WrittenAnswer q, WrittenGrade grade)
    {
        var (color, soft, title) = grade.Verdict switch
        {
            "correct" => ("Success", "SuccessSoft", "Full marks"),
            "partial" => ("Warning", "WarningSoft", "Partly there"),
            _ => ("Danger", "DangerSoft", "Not yet"),
        };
        var stack = new VerticalStackLayout { Spacing = 8 };
        var head = new Grid { ColumnDefinitions = [new(GridLength.Star), new(GridLength.Auto)] };
        head.Add(Ui.Text(title, 17, color, true), 0);
        head.Add(Ui.Text($"{grade.Score}%", 17, color, true), 1);
        stack.Children.Add(head);
        stack.Children.Add(Ui.Text(grade.Feedback, 14));
        foreach (var point in grade.Covered)
            stack.Children.Add(Ui.Text($"✓ {point}", 14, "Success"));
        foreach (var point in grade.Missed)
            stack.Children.Add(Ui.Text($"✗ {point}", 14, "Danger"));
        return Ui.Stack(12, Ui.Card(stack, 16, soft), ModelAnswer(q), ContinueButton());
    }

    static View ModelAnswer(WrittenAnswer q)
    {
        var answer = Ui.Text(q.ModelAnswer, 14);
        if (q.Kind == "code")
            answer.FontFamily = "monospace";
        return Ui.Card(Ui.Stack(8, Ui.Overline("MODEL ANSWER"), answer), 16, "Surface2");
    }

    Button ContinueButton() => Ui.Primary(_index + 1 < _questions.Count ? "Next question" : "See how I did", () =>
    {
        _index++;
        Next();
    });

    void Finish()
    {
        Host.SetProgress(1);
        var average = _scores.Count == 0 ? 0 : _scores.Average();
        Show(Ui.Stack(14,
            Ui.Icon("school", 56, "Accent"),
            Ui.Text($"{average:0}% average", 30, bold: true, align: TextAlignment.Center),
            Ui.Caption($"Across {_questions.Count} exam-style questions, as the AI marked them.", TextAlignment.Center),
            Ui.Primary("Go again", Begin),
            Ui.Secondary("Back to study modes", () => _ = Host.ExitAsync())));
    }
}
