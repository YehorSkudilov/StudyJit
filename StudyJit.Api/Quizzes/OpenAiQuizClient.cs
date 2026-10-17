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

/// <summary>What one generation writes: the questions, plus a study guide and key terms for the other study modes.</summary>
public record GeneratedQuiz(List<GeneratedQuestion> Questions, string Summary, List<GeneratedTerm> Terms, string CheatSheet);

/// <summary>What a quiz is generated from: the topic, plus text, images and documents from the linked files.</summary>
public class QuizSource
{
    public string Name { get; init; } = "";
    public string? Description { get; init; }
    public string? Prompt { get; init; }
    public int Questions { get; init; }
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
public class OpenAiQuizClient(HttpClient http, OpenAiOptions options, ILogger<OpenAiQuizClient> log)
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.ApiKey);

    const string Instructions = """
        You are an expert teacher preparing study material for a student revising. Base everything on the attached
        material when there is any (search it with file_search), otherwise on the topic, and write in the language of the
        material.

        questions: multiple-choice questions. Each has exactly four distinct, plausible options of similar length, one of
        them right; "correct" is the exact text of the right option. Test understanding and application, not just
        recall; cover the material broadly; avoid trick questions, "all of the above" and "none of the above".
        "explanation" says in one or two sentences why the right option is right (and, when useful, why a tempting
        wrong one isn't).

        summary: a concise study guide of the material in Markdown: a few "## " sections of short paragraphs and "- "
        bullet points, with key ideas in **bold**. No more than about 400 words.

        terms: the 8 to 20 most important terms, names or concepts, each with a short definition (one sentence) that
        doesn't repeat the term itself.

        cheat_sheet: the condensed notes a student would bring into an exam, in Markdown: "## " headings, short "- "
        bullets, **bold** for what matters most, compact "Term: meaning" lines, and any formulas, rules, steps and common
        mistakes. No introduction; every line worth its space; about one printed page (350 words at most).
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
            return Check(OutputText(response), source.Questions);
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
        text.AppendLine($"Write {source.Questions} questions for the quiz \"{source.Name}\".");
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
        ["summary"] = SchemaString(),
        ["terms"] = SchemaArray(SchemaObject(new() { ["term"] = SchemaString(), ["definition"] = SchemaString() })),
        ["cheat_sheet"] = SchemaString(),
    });


    /// <summary>Keeps the questions with four distinct options and a right answer among them, and the complete terms.</summary>
    static GeneratedQuiz Check(string text, int wanted)
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
            if (string.IsNullOrWhiteSpace(q.Question) || opts.Count != 4 || correct == null)
                continue;
            kept.Add(new GeneratedQuestion(q.Question.Trim(), opts, correct, q.Explanation?.Trim() ?? ""));
        }
        if (kept.Count == 0)
            throw new QuizGenerationException("The AI didn't write any usable questions. Please try again.");

        var terms = (quiz?.Terms ?? [])
            .Where(x => !string.IsNullOrWhiteSpace(x.Term) && !string.IsNullOrWhiteSpace(x.Definition))
            .Select(x => new GeneratedTerm(x.Term.Trim(), x.Definition.Trim()))
            .DistinctBy(x => x.Term, StringComparer.OrdinalIgnoreCase)
            .Take(MaxTerms).ToList();
        return new GeneratedQuiz(kept.Take(wanted).ToList(), quiz?.Summary?.Trim() ?? "", terms, quiz?.CheatSheet?.Trim() ?? "");
    }

    const int MaxTerms = 30;

    record QuizJson(List<GeneratedQuestion>? Questions, string? Summary, List<GeneratedTerm>? Terms,
        [property: System.Text.Json.Serialization.JsonPropertyName("cheat_sheet")] string? CheatSheet);

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
