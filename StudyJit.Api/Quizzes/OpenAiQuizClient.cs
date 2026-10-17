using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace StudyJit.Api.Quizzes;

public class OpenAiOptions
{
    /// <summary>OpenAI__ApiKey in .env. Unset turns generation off.</summary>
    public string? ApiKey { get; set; }
    public string Model { get; set; } = "gpt-6.1-sol";
    /// <summary>Sent as reasoning.effort for reasoning models; leave empty for models that don't take it.</summary>
    public string? ReasoningEffort { get; set; } = "low";
    public string BaseUrl { get; set; } = "https://api.openai.com/v1/";
    public int TimeoutSeconds { get; set; } = 300;
}

/// <summary>The AI couldn't produce a usable quiz; <see cref="Exception.Message"/> is safe to show.</summary>
public class QuizGenerationException(string message, Exception? inner = null) : Exception(message, inner);

public record GeneratedQuestion(string Question, List<string> Options, string Correct, string Explanation);

public record GeneratedTerm(string Term, string Definition);

public record GeneratedStatement(string Statement, [property: System.Text.Json.Serialization.JsonPropertyName("is_true")] bool IsTrue, string Explanation);

public record GeneratedShortAnswer(string Question, string Answer, List<string> Alternatives, string Explanation);

/// <summary>What one generation writes: content for each way of studying, a study guide and a cheat sheet.</summary>
public record GeneratedQuiz(List<GeneratedQuestion> Questions, string Summary, List<GeneratedTerm> Terms, string CheatSheet,
    List<GeneratedStatement> Statements, List<GeneratedShortAnswer> ShortAnswers);

/// <summary>What a quiz is generated from: the topic, plus text, images and documents from the linked files.</summary>
public class QuizSource
{
    public string Name { get; init; } = "";
    public string? Description { get; init; }
    public string? Prompt { get; init; }
    /// <summary>Plain-text files, inlined into the request.</summary>
    public List<(string Name, string Text)> Texts { get; } = [];
    /// <summary>Images, sent for the model to look at.</summary>
    public List<(string MimeType, byte[] Bytes)> Images { get; } = [];
    /// <summary>PDFs and Office documents, searched through a temporary vector store.</summary>
    public List<string> Documents { get; } = [];
}

/// <summary>
/// Writes multiple-choice questions, a study guide and key terms with OpenAI's Responses API. Documents go into a vector
/// store made for this one quiz (file_search), deleted again with their uploads once the questions are back; both are also
/// set to expire on their own, so a crash mid-generation leaves nothing behind for long. The answer is a strict JSON
/// schema, and every question is checked before it's kept.
/// </summary>
public partial class OpenAiQuizClient(HttpClient http, OpenAiOptions options, ILogger<OpenAiQuizClient> log)
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.ApiKey);

    const string Instructions = """
        You are an expert teacher preparing study material for a student revising. Base everything on the attached
        material when there is any (search it with file_search), otherwise on the topic, and write in the language of the
        material. Each part below feeds a different way of studying, so write each one for its own format.

        Everything must stand on its own: the student sees one item at a time, without the slides or notes. Never write
        "in the slides", "in the lecture", "shown above", "the example", "Figure 2", "the code below" or anything else
        that points at the material; if an item needs a piece of code, a formula or a scenario, put it in the item. Every
        item must be correct according to the material; when unsure, leave it out.

        questions (multiple choice): a bank the student is drilled from many times, a different mix each session, so it
        covers the material completely and varies:
        - Decide how many the material needs: go through every concept, fact, process, formula and example and write at
          least two questions on each important one, asked differently (e.g. one recall, one applied). Short material
          might need 15; a full lecture usually 30 to 60; never more than 80.
        - Mix the styles: definitions, "which example shows…", scenarios and applications, cause and effect,
          comparisons, ordering steps, spotting the mistake, predicting what code or a process does, and calculations or
          worked problems where the material has them. Don't repeat a question in other words.
        - Exactly four distinct options of similar length and style, exactly one right and the other three definitely
          wrong (real misconceptions, not silly). "correct" is the exact text of the right option. No trick questions,
          "all of the above", "none of the above", or questions whose answer depends on opinion.
        - "explanation": one or two sentences on why the right option is right (and, when useful, why a tempting wrong
          one isn't).

        true_false: 15 to 40 statements for a rapid true-or-false round. Each is one complete, self-contained
        declarative sentence about the material that is unambiguously true or unambiguously false: not a question, not
        a bare value or line of code on its own, and with no "always/never" wording that makes it a trick. Make about
        half false, each by changing one key detail of a true fact into a believable misconception. "explanation" says
        why it's true, or what's actually right if it's false.

        short_answers: 10 to 30 questions answered by typing a few words (1 to 4): a term, name, number, keyword or
        short expression. Ask only things with one clear answer a student could recall exactly; skip anything that needs
        a sentence to answer. "answer" is the expected answer; "alternatives" lists other answers that should also count
        (synonyms, abbreviations, other notations, with or without units); "explanation" is one sentence.

        terms (for flashcards and a term-matching game): every important term, name, concept and formula in the
        material (as many as it has, up to 40). "definition" is one short sentence (under 20 words) that identifies the
        term without using the term itself or words formed from it.

        summary: a concise study guide of the material in Markdown: a few "## " sections of short paragraphs and "- "
        bullet points, with key ideas in **bold**. No more than about 400 words.

        cheat_sheet: the condensed notes a student would bring into an exam, in Markdown, about one printed page (350
        words at most), no introduction, every line worth its space. Use 4 to 8 "## " sections by topic (e.g. "Key
        terms", "Formulas", "Process", one per main idea), and inside them:
        - "- **Term**: meaning" lines for definitions;
        - formulas, equations, code and units in `backticks`;
        - "1. " numbered lines for steps or sequences;
        - "- " bullets for facts, with **bold** on the words that matter most.
        Finish with a "## Common mistakes" section when the material has pitfalls worth flagging.
        """;

    public async Task<GeneratedQuiz> GenerateAsync(QuizSource source, CancellationToken ct)
    {
        if (!IsConfigured)
            throw new QuizGenerationException("Quiz generation isn't set up on this server.");

        var fileIds = new List<string>();
        string? vectorStoreId = null;
        try
        {
            foreach (var path in source.Documents)
            {
                try
                {
                    fileIds.Add(await UploadAsync(path, ct));
                }
                catch (HttpRequestException e)
                {
                    log.LogWarning(e, "Couldn't upload {File} to OpenAI; generating without it.", Path.GetFileName(path));
                }
            }
            if (fileIds.Count > 0)
                vectorStoreId = await CreateVectorStoreAsync(fileIds, ct);

            var content = new JsonArray { new JsonObject { ["type"] = "input_text", ["text"] = Request(source, vectorStoreId != null) } };
            foreach (var (mimeType, bytes) in source.Images)
                content.Add(new JsonObject { ["type"] = "input_image", ["image_url"] = $"data:{mimeType};base64,{Convert.ToBase64String(bytes)}" });

            var body = new JsonObject
            {
                ["model"] = options.Model,
                ["instructions"] = Instructions,
                ["input"] = new JsonArray { new JsonObject { ["role"] = "user", ["content"] = content } },
                ["text"] = new JsonObject
                {
                    ["format"] = new JsonObject { ["type"] = "json_schema", ["name"] = "quiz", ["strict"] = true, ["schema"] = Schema() },
                },
            };
            if (vectorStoreId != null)
                body["tools"] = new JsonArray { new JsonObject { ["type"] = "file_search", ["vector_store_ids"] = new JsonArray(vectorStoreId) } };
            if (!string.IsNullOrWhiteSpace(options.ReasoningEffort))
                body["reasoning"] = new JsonObject { ["effort"] = options.ReasoningEffort };

            var response = await SendAsync(HttpMethod.Post, "responses", JsonContent(body), ct);
            if (response["status"]?.GetValue<string>() is { } status && status != "completed")
                throw new QuizGenerationException("The AI didn't finish the quiz. Try fewer questions or smaller files.");
            return Check(OutputText(response));
        }
        finally
        {
            if (vectorStoreId != null)
                await TryDeleteAsync($"vector_stores/{vectorStoreId}");
            foreach (var id in fileIds)
                await TryDeleteAsync($"files/{id}");
        }
    }

    /// <summary>
    /// A small structured task (no files): the model reads the input and answers with JSON matching the schema, which
    /// comes back parsed. For helpers like reading a course list or planning study sets.
    /// </summary>
    public async Task<JsonNode> CompleteJsonAsync(string instructions, string input, string name, JsonObject schema, CancellationToken ct)
    {
        if (!IsConfigured)
            throw new QuizGenerationException("AI isn't set up on this server.");
        var body = new JsonObject
        {
            ["model"] = options.Model,
            ["instructions"] = instructions,
            ["input"] = input,
            ["text"] = new JsonObject
            {
                ["format"] = new JsonObject { ["type"] = "json_schema", ["name"] = name, ["strict"] = true, ["schema"] = schema },
            },
        };
        if (!string.IsNullOrWhiteSpace(options.ReasoningEffort))
            body["reasoning"] = new JsonObject { ["effort"] = options.ReasoningEffort };
        var response = await SendAsync(HttpMethod.Post, "responses", JsonContent(body), ct);
        try
        {
            return JsonNode.Parse(OutputText(response)) ?? throw new QuizGenerationException("The AI gave an empty answer. Please try again.");
        }
        catch (JsonException e)
        {
            throw new QuizGenerationException("The AI's answer couldn't be read. Please try again.", e);
        }
    }

    static string OutputText(JsonNode response) => string.Concat(
        (response["output"]?.AsArray() ?? [])
        .Where(o => o?["type"]?.GetValue<string>() == "message")
        .SelectMany(o => o!["content"]?.AsArray() ?? [])
        .Where(c => c?["type"]?.GetValue<string>() == "output_text")
        .Select(c => c!["text"]?.GetValue<string>()));

    /// <summary>A strict schema object: every property required, nothing else allowed.</summary>
    public static JsonObject SchemaObject(Dictionary<string, JsonNode> properties) => new()
    {
        ["type"] = "object",
        ["additionalProperties"] = false,
        ["required"] = new JsonArray(properties.Keys.Select(k => (JsonNode)k).ToArray()),
        ["properties"] = new JsonObject(properties.Select(p => KeyValuePair.Create(p.Key, (JsonNode?)p.Value))),
    };

    public static JsonObject SchemaArray(JsonNode items) => new() { ["type"] = "array", ["items"] = items };

    public static JsonObject SchemaString() => new() { ["type"] = "string" };

    public static JsonObject SchemaInteger() => new() { ["type"] = "integer" };

    static string Request(QuizSource source, bool hasDocuments)
    {
        var text = new System.Text.StringBuilder();
        text.AppendLine($"Write the study material for \"{source.Name}\".");
        if (!string.IsNullOrWhiteSpace(source.Description))
            text.AppendLine($"About the quiz: {source.Description}");
        if (!string.IsNullOrWhiteSpace(source.Prompt))
            text.AppendLine($"Topic and instructions: {source.Prompt}");
        if (hasDocuments)
            text.AppendLine("Use the attached documents as the main source.");
        foreach (var (name, content) in source.Texts)
            text.AppendLine().AppendLine($"--- {name} ---").AppendLine(content);
        return text.ToString();
    }

    static JsonObject Schema() => SchemaObject(new()
    {
        ["questions"] = SchemaArray(SchemaObject(new()
        {
            ["question"] = SchemaString(),
            ["options"] = SchemaArray(SchemaString()),
            ["correct"] = SchemaString(),
            ["explanation"] = SchemaString(),
        })),
        ["true_false"] = SchemaArray(SchemaObject(new()
        {
            ["statement"] = SchemaString(),
            ["is_true"] = new JsonObject { ["type"] = "boolean" },
            ["explanation"] = SchemaString(),
        })),
        ["short_answers"] = SchemaArray(SchemaObject(new()
        {
            ["question"] = SchemaString(),
            ["answer"] = SchemaString(),
            ["alternatives"] = SchemaArray(SchemaString()),
            ["explanation"] = SchemaString(),
        })),
        ["summary"] = SchemaString(),
        ["terms"] = SchemaArray(SchemaObject(new() { ["term"] = SchemaString(), ["definition"] = SchemaString() })),
        ["cheat_sheet"] = SchemaString(),
    });


    /// <summary>Keeps the questions with four distinct options and a right answer among them, and the complete terms.</summary>
    static GeneratedQuiz Check(string text)
    {
        QuizJson? quiz;
        try
        {
            quiz = JsonSerializer.Deserialize<QuizJson>(text, JsonSerializerOptions.Web);
        }
        catch (JsonException e)
        {
            throw new QuizGenerationException("The AI's answer couldn't be read. Please try again.", e);
        }

        var kept = new List<GeneratedQuestion>();
        foreach (var q in quiz?.Questions ?? [])
        {
            var opts = q.Options.Select(o => o.Trim()).Where(o => o.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).Take(4).ToList();
            var correct = opts.FirstOrDefault(o => string.Equals(o, q.Correct?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (string.IsNullOrWhiteSpace(q.Question) || opts.Count != 4 || correct == null || PointsAtMaterial(q.Question))
                continue;
            kept.Add(new GeneratedQuestion(q.Question.Trim(), opts, correct, q.Explanation?.Trim() ?? ""));
        }
        if (kept.Count == 0)
            throw new QuizGenerationException("The AI didn't write any usable questions. Please try again.");

        var terms = (quiz?.Terms ?? [])
            .Where(x => !string.IsNullOrWhiteSpace(x.Term) && !string.IsNullOrWhiteSpace(x.Definition))
            .Select(x => new GeneratedTerm(x.Term.Trim(), x.Definition.Trim()))
            // A definition that names its own term gives the flashcard or match away.
            .Where(x => !x.Definition.Contains(x.Term, StringComparison.OrdinalIgnoreCase))
            .DistinctBy(x => x.Term, StringComparer.OrdinalIgnoreCase)
            .Take(MaxTerms).ToList();

        var statements = (quiz?.TrueFalse ?? [])
            .Select(s => s with { Statement = s.Statement?.Trim() ?? "", Explanation = s.Explanation?.Trim() ?? "" })
            // A statement is a sentence: not a question, not a bare value or line of code.
            .Where(s => s.Statement.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length >= 4 && !s.Statement.EndsWith('?') && !PointsAtMaterial(s.Statement))
            .DistinctBy(s => s.Statement, StringComparer.OrdinalIgnoreCase)
            .Take(MaxStatements).ToList();

        var shortAnswers = (quiz?.ShortAnswers ?? [])
            .Select(s => new GeneratedShortAnswer(s.Question?.Trim() ?? "", s.Answer?.Trim() ?? "",
                (s.Alternatives ?? []).Select(a => a.Trim()).Where(a => a.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).Take(8).ToList(),
                s.Explanation?.Trim() ?? ""))
            // Short enough to type and recall exactly.
            .Where(s => s.Question.Length > 0 && s.Answer.Length is > 0 and <= 40 && s.Answer.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length <= 5
                && !PointsAtMaterial(s.Question))
            .DistinctBy(s => s.Question, StringComparer.OrdinalIgnoreCase)
            .Take(MaxShortAnswers).ToList();

        return new GeneratedQuiz(kept.Take(MaxQuestions).ToList(), quiz?.Summary?.Trim() ?? "", terms, quiz?.CheatSheet?.Trim() ?? "",
            statements, shortAnswers);
    }

    /// <summary>
    /// Items that lean on the material ("shown in the slides", "the example above") make no sense on their own, as the
    /// student sees them; they're dropped even if the AI writes them despite being told not to.
    /// </summary>
    static bool PointsAtMaterial(string text) => MaterialReference().IsMatch(text);

    [System.Text.RegularExpressions.GeneratedRegex(
        @"\b(in|from|on|per|according to) the (slides?|lecture|notes|reading|document|text|video|figure|diagram|table|handout|textbook)\b|\b(shown|given|listed|described) (above|below|earlier|in the)\b|\bthe (example|code|figure|diagram|table) (above|below)\b",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase)]
    private static partial System.Text.RegularExpressions.Regex MaterialReference();

    const int MaxTerms = 40;
    const int MaxStatements = 40;
    const int MaxShortAnswers = 30;

    /// <summary>The most questions kept from one generation; the AI decides how many the material needs, up to this.</summary>
    public const int MaxQuestions = 80;

    record QuizJson(List<GeneratedQuestion>? Questions, string? Summary, List<GeneratedTerm>? Terms,
        [property: System.Text.Json.Serialization.JsonPropertyName("cheat_sheet")] string? CheatSheet,
        [property: System.Text.Json.Serialization.JsonPropertyName("true_false")] List<GeneratedStatement>? TrueFalse,
        [property: System.Text.Json.Serialization.JsonPropertyName("short_answers")] List<GeneratedShortAnswer>? ShortAnswers);

    /// <summary>How long an upload lives if it isn't deleted (OpenAI's shortest is an hour).</summary>
    const int UploadLifetimeSeconds = 6 * 3600;

    async Task<string> UploadAsync(string path, CancellationToken ct)
    {
        await using var stream = File.OpenRead(path);
        using var form = new MultipartFormDataContent
        {
            { new StringContent("assistants"), "purpose" },
            // Deleted once the quiz is generated; this is in case the server stops before it gets to.
            { new StringContent("created_at"), "expires_after[anchor]" },
            { new StringContent(UploadLifetimeSeconds.ToString()), "expires_after[seconds]" },
            { new StreamContent(stream), "file", Path.GetFileName(path) },
        };
        var response = await SendAsync(HttpMethod.Post, "files", form, ct);
        return response["id"]!.GetValue<string>();
    }

    /// <summary>Makes a vector store of the files and waits until they're searchable.</summary>
    async Task<string> CreateVectorStoreAsync(List<string> fileIds, CancellationToken ct)
    {
        var store = await SendAsync(HttpMethod.Post, "vector_stores",
            JsonContent(new JsonObject
            {
                ["name"] = "studyjit-quiz",
                ["file_ids"] = new JsonArray(fileIds.Select(id => (JsonNode)id).ToArray()),
                // Like the uploads: deleted after generating, and gone a day after its last use if that never happens.
                ["expires_after"] = new JsonObject { ["anchor"] = "last_active_at", ["days"] = 1 },
            }), ct);
        var id = store["id"]!.GetValue<string>();
        for (var waited = 0; store["status"]?.GetValue<string>() == "in_progress"; waited++)
        {
            if (waited >= 90)
                throw new QuizGenerationException("Reading the files took too long. Please try again.");
            await Task.Delay(TimeSpan.FromSeconds(2), ct);
            store = await SendAsync(HttpMethod.Get, $"vector_stores/{id}", null, ct);
        }
        if (store["file_counts"]?["completed"]?.GetValue<int>() == 0)
            throw new QuizGenerationException("None of the files could be read. Check that they're readable documents.");
        return id;
    }

    async Task<JsonNode> SendAsync(HttpMethod method, string path, HttpContent? content, CancellationToken ct)
    {
        using var message = new HttpRequestMessage(method, new Uri(new Uri(options.BaseUrl), path)) { Content = content };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
        using var response = await http.SendAsync(message, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            log.LogWarning("OpenAI {Method} {Path} failed with {Status}: {Body}", method, path, (int)response.StatusCode, text);
            throw new QuizGenerationException((int)response.StatusCode == 429
                ? "The AI is busy right now. Please try again in a few minutes."
                : "The AI service refused the request. Please try again.");
        }
        return JsonNode.Parse(text) ?? new JsonObject();
    }

    async Task TryDeleteAsync(string path)
    {
        try
        {
            await SendAsync(HttpMethod.Delete, path, null, CancellationToken.None);
        }
        catch (Exception e) when (e is QuizGenerationException or HttpRequestException)
        {
            log.LogWarning(e, "Couldn't delete OpenAI {Path}.", path);
        }
    }

    static StringContent JsonContent(JsonNode body) => new(body.ToJsonString(), System.Text.Encoding.UTF8, "application/json");
}
