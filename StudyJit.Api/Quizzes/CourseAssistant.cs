using System.Text;
using System.Text.Json.Nodes;
using static StudyJit.Api.Quizzes.OpenAiQuizClient;

namespace StudyJit.Api.Quizzes;

public record ParsedCourse(string Code, string Name, string Term);

public record PlannedSet(string Name, string Description, string Focus, List<int> FileIds, int Questions);

/// <summary>A file the planner may assign to a study set: its name, size and, for plain text, the start of it.</summary>
public record PlanFile(int Id, string Name, long Size, string? Excerpt);

/// <summary>The AI's course helpers: reading courses out of a pasted list, and planning a course's study sets.</summary>
public class CourseAssistant(OpenAiQuizClient openAi)
{
    public bool IsConfigured => openAi.IsConfigured;

    const int MaxInputChars = 20_000;

    const string ParseInstructions = """
        The user pasted text copied from their school's learning system (a course list, a timetable, a transcript or
        similar). Pull out the distinct courses they're taking.

        For each course:
        - code: the subject and number in a clean form, e.g. "COMP 3760" or "MATH 3042" (normalise "COMP-3721-0" to
          "COMP 3721"); empty if there's none.
        - name: the course title only, cleaned up: drop section numbers, campus codes (like "BBY"), CRNs, "(merge ...)"
          notes and other enrolment noise. E.g. "Algorithms", "Introduction to Data Communications".
        - term: the term it's in, written like "Fall 2026" or "Winter 2026", when the text says; otherwise empty.

        List each course once, even if it shows up several times (e.g. lecture and lab sections). Ignore navigation
        and filter labels such as "All", "Ongoing" or term codes on their own. If the text has no courses, return none.
        """;

    public async Task<List<ParsedCourse>> ParseCoursesAsync(string text, CancellationToken ct)
    {
        var input = text.Length > MaxInputChars ? text[..MaxInputChars] : text;
        var schema = SchemaObject(new()
        {
            ["courses"] = SchemaArray(SchemaObject(new()
            {
                ["code"] = SchemaString(),
                ["name"] = SchemaString(),
                ["term"] = SchemaString(),
            })),
        });
        var answer = await openAi.CompleteJsonAsync(ParseInstructions, input, "courses", schema, ct);
        return (answer["courses"]?.AsArray() ?? [])
            .Select(c => new ParsedCourse(Text(c?["code"]), Text(c?["name"]), Text(c?["term"])))
            .Where(c => c.Name.Length > 0)
            .DistinctBy(c => (c.Code.ToUpperInvariant(), c.Name.ToUpperInvariant()))
            .Take(Controllers.CoursesController.MaxCourses)
            .ToList();
    }

    const string PlanInstructions = """
        You are planning a student's revision for one course. Split the course into study sets: focused chunks that each
        get their own quiz, flashcards and study guide.

        When files are listed, base the plan on them: usually one set per lecture, week, chapter or topic (judge by the
        file names and excerpts), each with the ids of the files it covers; files that belong together can share a set.
        Add one final cumulative review set (e.g. "Midterm review") covering everything, with all the file ids, when
        there's more than one other set. When there are no files, plan the topics such a course normally covers, from
        its code and name, with empty file lists.

        For each set:
        - name: short and specific, like "Week 3 · Sorting algorithms" or "Hypothesis testing".
        - description: one sentence on what it covers.
        - focus: instructions for the question writer: the topics and skills to test, and anything to emphasise.
        - file_ids: ids from the list only.
        - questions: how many questions suit it, 8 to 25 (more for the review set).

        Keep to the number of sets asked for, at most.
        """;

    public async Task<List<PlannedSet>> PlanAsync(string course, List<PlanFile> files, int maxSets, CancellationToken ct)
    {
        var input = new StringBuilder();
        input.AppendLine($"Course: {course}");
        input.AppendLine($"Plan at most {maxSets} study sets.");
        if (files.Count == 0)
            input.AppendLine("There are no files yet.");
        else
        {
            input.AppendLine("Files:");
            foreach (var f in files)
            {
                input.AppendLine($"- id {f.Id}: {f.Name} ({Math.Max(1, f.Size / 1024)} KB)");
                if (!string.IsNullOrWhiteSpace(f.Excerpt))
                    input.AppendLine($"  starts: {f.Excerpt.ReplaceLineEndings(" ")}");
            }
        }

        var schema = SchemaObject(new()
        {
            ["sets"] = SchemaArray(SchemaObject(new()
            {
                ["name"] = SchemaString(),
                ["description"] = SchemaString(),
                ["focus"] = SchemaString(),
                ["file_ids"] = SchemaArray(SchemaInteger()),
                ["questions"] = SchemaInteger(),
            })),
        });
        var text = input.ToString();
        var answer = await openAi.CompleteJsonAsync(PlanInstructions, text.Length > MaxInputChars ? text[..MaxInputChars] : text, "plan", schema, ct);
        var known = files.Select(f => f.Id).ToHashSet();
        return (answer["sets"]?.AsArray() ?? [])
            .Select(s => new PlannedSet(
                Text(s?["name"]),
                Text(s?["description"]),
                Text(s?["focus"]),
                (s?["file_ids"]?.AsArray() ?? []).Select(id => id?.GetValue<int>() ?? 0).Where(known.Contains).Distinct().ToList(),
                Math.Clamp(s?["questions"]?.GetValue<int>() ?? 12, 5, Controllers.QuizzesController.MaxQuestions)))
            .Where(s => s.Name.Length > 0)
            .Take(maxSets)
            .ToList();
    }

    const string CheatSheetInstructions = """
        You write cheat sheets: the condensed notes a student would bring into an exam or skim the night before. Work
        from the course material given (study guides, key terms and quiz questions with explanations). If there's
        none, write from what such a course normally covers.

        Write Markdown only: "## " section headings, short "- " bullet points, **bold** for the terms and facts that
        matter most, and compact "Term: meaning" lines. Include formulas, rules, steps, comparisons and the common
        mistakes the questions reveal. No introduction and no closing remarks: every line should be worth its space.
        Write in the language of the material.

        title: a short title for the sheet, e.g. "Midterm cheat sheet" or "Sorting algorithms at a glance".
        """;

    /// <summary>Writes a cheat sheet for the course from its study material; returns its title and Markdown.</summary>
    public async Task<(string Title, string Content)> CheatSheetAsync(string course, string material, string focus, bool detailed, CancellationToken ct)
    {
        var input = new StringBuilder();
        input.AppendLine($"Course: {course}");
        input.AppendLine(detailed
            ? "Length: detailed, up to about 1200 words."
            : "Length: one printed page, about 450 words at most.");
        if (!string.IsNullOrWhiteSpace(focus))
            input.AppendLine($"Focus on: {focus}");
        input.AppendLine();
        input.AppendLine(string.IsNullOrWhiteSpace(material) ? "No material yet." : material);
        var text = input.ToString();

        var schema = SchemaObject(new() { ["title"] = SchemaString(), ["content"] = SchemaString() });
        var answer = await openAi.CompleteJsonAsync(CheatSheetInstructions, text.Length > MaxMaterialChars ? text[..MaxMaterialChars] : text, "cheat_sheet", schema, ct);
        var content = Text(answer["content"]);
        if (content.Length == 0)
            throw new QuizGenerationException("The AI didn't write the cheat sheet. Please try again.");
        var title = Text(answer["title"]);
        return (title.Length == 0 ? "Cheat sheet" : title.Length > 255 ? title[..255] : title, content);
    }

    const int MaxMaterialChars = 120_000;

    static string Text(JsonNode? node) => node?.GetValue<string>()?.Trim() ?? "";
}
