using System.Text;
using System.Text.Json.Nodes;
using static StudyJit.Api.Quizzes.OpenAiQuizClient;

namespace StudyJit.Api.Quizzes;

public record ParsedCourse(string Code, string Name, string Term);

/// <summary>A file for the AI to sort: its name, size and, for plain text, the start of it.</summary>
public record PlanFile(int Id, string Name, long Size, string? Excerpt);

/// <summary>The AI's course helpers: reading courses out of a pasted list, and sorting a course's files into folders.</summary>
public class CourseAssistant(OpenAiQuizClient openAi)
{
    public bool IsConfigured => openAi.IsConfigured;

    const int MaxInputChars = 20_000;

    const string ParseInstructions = """
        The user pasted text copied from their school's learning system (a course list, a timetable, a transcript or
        similar). Pull out the distinct courses they're taking.

        For each course:
        - code: the subject and number in a clean form, e.g. "BIO 101" or "HIST 210" (normalise "HIST-210-01" to
          "HIST 210"); empty if there's none.
        - name: the course title only, cleaned up: drop section numbers, campus codes, CRNs, "(merge ...)" notes and
          other enrolment noise. E.g. "Introduction to Biology", "World History II".
        - term: the term it's in, written like "Spring 2025" or "Autumn 2025", when the text says; otherwise empty.

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

    const string OrganizeInstructions = """
        Sort a course's files into folders the way a tidy student would: usually by week, lecture, unit or chapter.
        Work it out from each file's name AND what's inside it (its title and opening words, given as "inside:"), since
        names are often unhelpful ("Lecture_03_final.pdf", "slides (2).pptx"); numbers in names or titles usually give
        the order. Keep assessments, labs, syllabus or admin material in their own folders when there are any.

        Name folders short and consistent, like "Week 1", "Week 2", "Lab work", "Syllabus"; when the course already has
        folders, reuse their exact names for files that belong in them. Keep the order the course runs in. Put every
        file id in exactly one folder; don't make a folder for a single stray file unless it really stands alone.
        """;

    /// <summary>
    /// The AI's folder layout for the course's files; nothing is moved until it's applied. Files the AI leaves out go in
    /// an "Other" folder, so applying it always sorts everything.
    /// </summary>
    public async Task<List<Controllers.FolderPlan>> OrganizeAsync(string course, List<PlanFile> files, List<string> existingFolders, CancellationToken ct)
    {
        var input = new StringBuilder();
        input.AppendLine($"Course: {course}");
        if (existingFolders.Count > 0)
            input.AppendLine($"Folders it already has: {string.Join(", ", existingFolders.Select(f => $"\"{f}\""))}");
        input.AppendLine("Files:");
        foreach (var f in files)
        {
            input.AppendLine($"- id {f.Id}: {f.Name}");
            if (!string.IsNullOrWhiteSpace(f.Excerpt))
                input.AppendLine($"  inside: {f.Excerpt.ReplaceLineEndings(" ")}");
        }
        var schema = SchemaObject(new()
        {
            ["folders"] = SchemaArray(SchemaObject(new() { ["name"] = SchemaString(), ["file_ids"] = SchemaArray(SchemaInteger()) })),
        });
        var text = input.ToString();
        var answer = await openAi.CompleteJsonAsync(OrganizeInstructions, text.Length > MaxInputChars ? text[..MaxInputChars] : text, "folders", schema, ct);
        var known = files.Select(f => f.Id).ToHashSet();
        var placed = new HashSet<int>();
        var plans = new List<Controllers.FolderPlan>();
        foreach (var folder in answer["folders"]?.AsArray() ?? [])
        {
            var name = Text(folder?["name"]);
            // Each file goes in the first folder that claims it.
            var ids = (folder?["file_ids"]?.AsArray() ?? []).Select(id => id?.GetValue<int>() ?? 0).Where(id => known.Contains(id) && placed.Add(id)).ToList();
            if (name.Length > 0 && ids.Count > 0)
                plans.Add(new Controllers.FolderPlan(name.Length > 255 ? name[..255] : name, ids));
        }
        var left = files.Select(f => f.Id).Where(id => !placed.Contains(id)).ToList();
        if (left.Count > 0)
        {
            var other = plans.FindIndex(p => p.Name == "Other");
            if (other >= 0)
                plans[other] = plans[other] with { FileIds = [.. plans[other].FileIds, .. left] };
            else
                plans.Add(new Controllers.FolderPlan("Other", left));
        }
        if (plans.Count == 0)
            throw new QuizGenerationException("The AI couldn't sort the files. Please try again.");
        return plans;
    }

    static string Text(JsonNode? node) => node?.GetValue<string>()?.Trim() ?? "";
}
