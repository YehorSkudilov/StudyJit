using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using StudyJit.Models;

namespace StudyJit.Services;

/// <summary>A refused or failed API call, with a message that's safe to show.</summary>
public class ApiException(string message, HttpStatusCode? status = null) : Exception(message)
{
    public HttpStatusCode? Status { get; } = status;
}

/// <summary>
/// The app's side of StudyJit.Api, as the website's lib/api.ts and lib/courses.ts call it. Every call carries the
/// signed-in user's access token, renewed with the refresh token when it runs out; a session that can't be renewed is
/// cleared (the sign-in sheet then comes up, see SignInGate).
/// </summary>
public class ApiClient(HttpClient http, AuthSession session)
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    readonly SemaphoreSlim _refreshing = new(1, 1);

    // ---------- Account ----------

    /// <summary>Whether anyone may register; an admin can turn sign-up off. Assumes open if the API can't be reached.</summary>
    public async Task<bool> SignUpEnabledAsync()
    {
        try
        {
            return (await http.GetFromJsonAsync<AuthOptions>("api/auth/options", Json))?.SignUpEnabled ?? true;
        }
        catch (Exception)
        {
            return true;
        }
    }

    public Task SignInAsync(string email, string password) =>
        AuthenticateAsync("api/auth/login", new { email, password }, "Invalid email or password.");

    public Task RegisterAsync(string name, string email, string password) =>
        AuthenticateAsync("api/auth/register", new { name, email, password }, "Couldn't create the account.");

    async Task AuthenticateAsync(string path, object body, string fallback)
    {
        using var response = await SendAnonymousAsync(() => http.PostAsJsonAsync(path, body, Json));
        await EnsureOkAsync(response, fallback);
        await session.SetAsync((await response.Content.ReadFromJsonAsync<AuthResponse>(Json))!);
    }

    public async Task SignOutAsync()
    {
        var token = session.RefreshToken;
        session.Clear();
        if (token == null)
            return;
        try
        {
            using var _ = await http.PostAsJsonAsync("api/auth/logout", new { refreshToken = token }, Json);
        }
        catch (Exception)
        {
            // Best effort: the session is gone here either way.
        }
    }

    public Task<Profile> ProfileAsync() => GetAsync<Profile>("api/users", "Couldn't load your profile.");

    public Task UpdateProfileAsync(UpdateProfileRequest request) =>
        SendAsync(HttpMethod.Patch, "api/users", request, "Couldn't save your profile.");

    // ---------- Courses ----------

    public Task<List<Course>> CoursesAsync() => GetAsync<List<Course>>("api/courses", "Couldn't load your courses.");

    public Task<Course> CourseAsync(int id) => GetAsync<Course>($"api/courses/{id}", "Couldn't load this course.");

    public Task<Course> CreateCourseAsync(CourseDraft draft) =>
        SendAsync<Course>(HttpMethod.Post, "api/courses", draft, "Couldn't create the course.");

    public Task<List<Course>> CreateCoursesAsync(IEnumerable<CourseDraft> drafts) =>
        SendAsync<List<Course>>(HttpMethod.Post, "api/courses/bulk", new { courses = drafts }, "Couldn't create the courses.");

    public Task<Course> UpdateCourseAsync(int id, CourseDraft fields) =>
        SendAsync<Course>(HttpMethod.Patch, $"api/courses/{id}", fields, "Couldn't save the course.");

    public Task DeleteCourseAsync(int id) => SendAsync(HttpMethod.Delete, $"api/courses/{id}", null, "Couldn't delete the course.");

    /// <summary>The AI reads the courses out of pasted text; nothing is saved until they're created.</summary>
    public async Task<List<CourseDraft>> ParseCoursesAsync(string text) =>
        (await SendAsync<CourseList>(HttpMethod.Post, "api/ai/courses/parse", new { text }, "The AI couldn't read that.")).Courses;

    record CourseList(List<CourseDraft> Courses);

    // ---------- Study sets and exams ----------

    /// <summary>A course's study sets and exams, or every one with <paramref name="courseId"/> null; newest first.</summary>
    public Task<List<QuizSummary>> QuizzesAsync(int? courseId) =>
        GetAsync<List<QuizSummary>>($"api/items/quizzes/getAll?course={courseId?.ToString() ?? "all"}", "Couldn't load the study sets.");

    public Task<StudyQuiz> QuizAsync(int id) => GetAsync<StudyQuiz>($"api/items/quizzes/get/{id}", "Couldn't load this study set.");

    /// <summary>Records a percentage as the set's last score (what the course and the lists show).</summary>
    public async Task SaveScoreAsync(int quizId, double percent)
    {
        try
        {
            await SendAsync(HttpMethod.Patch, "api/items/quizzes/update", new { id = quizId, lastScore = Math.Round(percent, 2) }, "");
        }
        catch (Exception)
        {
            // The score is a nicety; studying goes on without it.
        }
    }

    public Task DeleteQuizzesAsync(IEnumerable<int> ids) =>
        SendAsync(HttpMethod.Post, "api/items/quizzes/delete", new { ids }, "Couldn't delete it.");

    /// <summary>Queues study sets (or exams) to be generated again, as one request.</summary>
    public Task RegenerateAsync(IEnumerable<int> quizIds) =>
        SendAsync(HttpMethod.Post, "api/ai/regenerate", new { quiz_ids = quizIds }, "Couldn't start regenerating.");

    /// <summary>An exam combining the chosen study sets, generated from their files and guides.</summary>
    public async Task<QuizSummary> CreateExamAsync(int courseId, string name, IEnumerable<int> setIds, string focus) =>
        (await SendAsync<CreatedQuizzes>(HttpMethod.Post, $"api/ai/courses/{courseId}/exams", new { name, set_ids = setIds, focus },
            "Couldn't create the exam.")).Created[0];

    record CreatedQuizzes(List<QuizSummary> Created);

    public Task<WrittenGrade> GradeWrittenAsync(int writtenAnswerId, string answer) =>
        SendAsync<WrittenGrade>(HttpMethod.Post, "api/ai/gradeWritten", new { written_answer_id = writtenAnswerId, answer },
            "Couldn't mark this answer. Please try again.");

    // ---------- Files and folders ----------

    public Task<List<CourseFile>> FilesAsync(int courseId) => GetAsync<List<CourseFile>>($"api/items/files?course={courseId}", "Couldn't load the files.");

    public Task DeleteFilesAsync(IEnumerable<int> ids) => SendAsync(HttpMethod.Post, "api/items/files/delete", new { ids }, "Couldn't delete the files.");

    public Task<List<CourseFolder>> FoldersAsync(int courseId) =>
        GetAsync<List<CourseFolder>>($"api/courses/{courseId}/folders", "Couldn't load the folders.");

    public Task<CourseFolder> CreateFolderAsync(int courseId, string name) =>
        SendAsync<CourseFolder>(HttpMethod.Post, $"api/courses/{courseId}/folders", new { name }, "Couldn't create the folder.");

    public Task RenameFolderAsync(int courseId, int folderId, string name) =>
        SendAsync(HttpMethod.Patch, $"api/courses/{courseId}/folders/{folderId}", new { name }, "Couldn't rename the folder.");

    public Task DeleteFolderAsync(int courseId, int folderId) =>
        SendAsync(HttpMethod.Delete, $"api/courses/{courseId}/folders/{folderId}", null, "Couldn't delete the folder.");

    public Task MoveFilesAsync(int courseId, IEnumerable<int> fileIds, int? folderId) =>
        SendAsync(HttpMethod.Post, $"api/courses/{courseId}/files/move", new { file_ids = fileIds, folder_id = folderId }, "Couldn't move the files.");

    /// <summary>The AI's suggested folders for the course's files; nothing moves until they're applied.</summary>
    public async Task<List<FolderPlan>> OrganizeFilesAsync(int courseId) =>
        (await SendAsync<FolderPlans>(HttpMethod.Post, $"api/ai/courses/{courseId}/organize", null, "The AI couldn't sort the files.")).Folders;

    record FolderPlans(List<FolderPlan> Folders);

    public Task ApplyFoldersAsync(int courseId, List<FolderPlan> folders) =>
        SendAsync(HttpMethod.Post, $"api/courses/{courseId}/folders/apply", new { folders }, "Couldn't apply the folders.");

    /// <summary>Uploads a file into a course (and folder) in 5 MB chunks, as the website does.</summary>
    public async Task UploadFileAsync(Stream content, long size, string fileName, int courseId, int? folderId, IProgress<double>? progress = null)
    {
        const int Chunk = 5 * 1024 * 1024;
        var buffer = new byte[Chunk];
        long start = 0;
        // An empty file is still one (empty) chunk.
        do
        {
            var read = 0;
            while (read < Chunk && start + read < size)
            {
                var n = await content.ReadAsync(buffer.AsMemory(read, (int)Math.Min(Chunk - read, size - start - read)));
                if (n == 0)
                    break;
                read += n;
            }
            var end = start + read;
            var chunk = buffer[..read];
            using var response = await SendAuthorizedAsync(() =>
            {
                var request = new HttpRequestMessage(HttpMethod.Post, "api/items/files/upload") { Content = new ByteArrayContent(chunk) };
                request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
                request.Content.Headers.TryAddWithoutValidation("Content-Range", $"bytes {start}-{Math.Max(end - 1, start)}/{Math.Max(size, 1)}");
                request.Headers.Add("X-Filename", Uri.EscapeDataString(fileName));
                request.Headers.Add("X-Folder", folderId?.ToString() ?? "root");
                request.Headers.Add("X-Course", courseId.ToString());
                return request;
            });
            await EnsureOkAsync(response, $"Uploading {fileName} failed.");
            start = end;
            progress?.Report(size == 0 ? 1 : (double)end / size);
            if (read == 0)
                break;
        } while (start < size);
    }

    /// <summary>Has the server download a YouTube video into the course (and folder), reporting its progress events.</summary>
    public async Task UploadYouTubeAsync(string url, int courseId, int? folderId, IProgress<double>? progress = null)
    {
        using var response = await SendAuthorizedAsync(() =>
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "api/items/files/upload")
            {
                Content = JsonContent.Create(new { url = url.Trim(), folder = folderId?.ToString() ?? "root", course = courseId }, options: Json),
            };
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
            return request;
        }, HttpCompletionOption.ResponseHeadersRead);
        await EnsureOkAsync(response, "YouTube download failed.");
        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync());
        while (await reader.ReadLineAsync() is { } line)
        {
            if (!line.StartsWith("data:"))
                continue;
            using var doc = JsonDocument.Parse(line[5..].Trim());
            var root = doc.RootElement;
            var status = root.TryGetProperty("status", out var s) ? s.GetString() : null;
            if (status == "error")
                throw new ApiException(root.TryGetProperty("error", out var e) ? e.GetString() ?? "Download failed." : "Download failed.");
            if (root.TryGetProperty("percent", out var p) && p.TryGetDouble(out var percent))
                progress?.Report(percent / 100);
            if (status == "complete")
                return;
        }
    }

    // ---------- Plumbing ----------

    async Task<T> GetAsync<T>(string path, string fallback)
    {
        using var response = await SendAuthorizedAsync(() => new HttpRequestMessage(HttpMethod.Get, path));
        await EnsureOkAsync(response, fallback);
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    async Task<T> SendAsync<T>(HttpMethod method, string path, object? body, string fallback)
    {
        using var response = await SendAuthorizedAsync(() => Request(method, path, body));
        await EnsureOkAsync(response, fallback);
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    async Task SendAsync(HttpMethod method, string path, object? body, string fallback)
    {
        using var response = await SendAuthorizedAsync(() => Request(method, path, body));
        await EnsureOkAsync(response, fallback);
    }

    static HttpRequestMessage Request(HttpMethod method, string path, object? body) =>
        new(method, path) { Content = body == null ? null : JsonContent.Create(body, body.GetType(), options: Json) };

    /// <summary>
    /// Sends with the access token (made fresh for each try, as a request can't be sent twice). A rejected token is
    /// renewed once and the call retried; if the session can't be renewed it's cleared.
    /// </summary>
    async Task<HttpResponseMessage> SendAuthorizedAsync(Func<HttpRequestMessage> make, HttpCompletionOption completion = HttpCompletionOption.ResponseContentRead)
    {
        await session.EnsureLoadedAsync();
        if (!session.IsSignedIn)
            throw new ApiException("Please sign in again.", HttpStatusCode.Unauthorized);
        var response = await SendAnonymousAsync(async () =>
        {
            var request = make();
            request.Headers.Authorization = new("Bearer", await AccessTokenAsync(false));
            return await http.SendAsync(request, completion);
        });
        if (response.StatusCode != HttpStatusCode.Unauthorized || !session.IsSignedIn)
            return response;
        response.Dispose();
        var token = await AccessTokenAsync(true);
        return await SendAnonymousAsync(async () =>
        {
            var request = make();
            request.Headers.Authorization = new("Bearer", token);
            return await http.SendAsync(request, completion);
        });
    }

    /// <summary>The call, with "no connection" turned into a message to show.</summary>
    static async Task<HttpResponseMessage> SendAnonymousAsync(Func<Task<HttpResponseMessage>> send)
    {
        try
        {
            return await send();
        }
        catch (HttpRequestException)
        {
            throw new ApiException("Can't reach StudyJit. Check your connection and try again.");
        }
        catch (TaskCanceledException)
        {
            throw new ApiException("StudyJit took too long to answer. Please try again.");
        }
    }

    async Task<string?> AccessTokenAsync(bool forceRefresh)
    {
        if (!forceRefresh && session.AccessToken != null && session.AccessTokenExpiresAt > DateTimeOffset.UtcNow.AddSeconds(30))
            return session.AccessToken;
        var stale = session.AccessToken;
        // One renewal at a time: a refresh token works once.
        await _refreshing.WaitAsync();
        try
        {
            // Renewed by another call meanwhile.
            if (session.AccessToken != stale && session.AccessToken != null)
                return session.AccessToken;
            if (session.RefreshToken is not { } refresh)
                return null;
            using var response = await SendAnonymousAsync(() => http.PostAsJsonAsync("api/auth/refresh", new { refreshToken = refresh }, Json));
            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.BadRequest)
                    session.Clear();
                return null;
            }
            await session.SetAsync((await response.Content.ReadFromJsonAsync<AuthResponse>(Json))!);
            return session.AccessToken;
        }
        finally
        {
            _refreshing.Release();
        }
    }

    /// <summary>Throws the API's own message for a refused request (or <paramref name="fallback"/>).</summary>
    static async Task EnsureOkAsync(HttpResponseMessage response, string fallback)
    {
        if (response.IsSuccessStatusCode)
            return;
        if (response.StatusCode == HttpStatusCode.TooManyRequests)
            throw new ApiException("You've reached the hourly limit for this. Please try again a little later.", response.StatusCode);
        string? message = null;
        try
        {
            var body = await response.Content.ReadFromJsonAsync<ErrorBody>(Json);
            message = body?.Error ?? body?.Title;
        }
        catch (Exception)
        {
            // Not JSON (a proxy's error page): the fallback says it.
        }
        throw new ApiException(string.IsNullOrWhiteSpace(message) ? fallback : message, response.StatusCode);
    }
}
