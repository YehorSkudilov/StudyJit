using StudyJit.Models;

namespace StudyJit.Services.Offline;

/// <summary>
/// What the screens show, from the server when it can be reached and from the device's copy (<see cref="LocalStore"/>)
/// when it can't. Every answer from the server is saved as it arrives, so whatever was seen once (and everything
/// <see cref="SyncService"/> downloads ahead) is there offline. The Cached* calls give the saved copy at once, for showing
/// something while the fresh one comes.
/// </summary>
public class StudyData(ApiClient api, LocalStore store, ConnectionState connection)
{
    const string CoursesKey = "courses", QuizzesKey = "quizzes", ProfileKey = "profile";
    static string QuizKey(int id) => $"quiz:{id}";
    static string FilesKey(int courseId) => $"files:{courseId}";
    static string FoldersKey(int courseId) => $"folders:{courseId}";

    public Task<List<Course>> CoursesAsync() => FetchAsync(CoursesKey, api.CoursesAsync);

    public List<Course>? CachedCourses() => store.Get<List<Course>>(CoursesKey);

    public async Task<Course> CourseAsync(int id)
    {
        try
        {
            var course = await api.CourseAsync(id);
            connection.Report(true);
            return course;
        }
        catch (ApiException e) when (e.IsOffline && CachedCourse(id) is { } cached)
        {
            connection.Report(false);
            return cached;
        }
    }

    public Course? CachedCourse(int id) => CachedCourses()?.FirstOrDefault(c => c.Id == id);

    /// <summary>A course's study sets and exams, or with <paramref name="courseId"/> null every one; newest first.</summary>
    public async Task<List<QuizSummary>> QuizzesAsync(int? courseId) => Of(await FetchAsync(QuizzesKey, () => api.QuizzesAsync(null)), courseId);

    public List<QuizSummary>? CachedQuizzes(int? courseId) => store.Get<List<QuizSummary>>(QuizzesKey) is { } all ? Of(all, courseId) : null;

    static List<QuizSummary> Of(List<QuizSummary> all, int? courseId) => courseId == null ? all : all.Where(q => q.CourseId == courseId).ToList();

    public Task<StudyQuiz> QuizAsync(int id) => FetchAsync(QuizKey(id), () => api.QuizAsync(id));

    public StudyQuiz? CachedQuiz(int id) => store.Get<StudyQuiz>(QuizKey(id));

    public Task<List<CourseFile>> FilesAsync(int courseId) => FetchAsync(FilesKey(courseId), () => api.FilesAsync(courseId));

    public List<CourseFile>? CachedFiles(int courseId) => store.Get<List<CourseFile>>(FilesKey(courseId));

    public Task<List<CourseFolder>> FoldersAsync(int courseId) => FetchAsync(FoldersKey(courseId), () => api.FoldersAsync(courseId));

    public List<CourseFolder>? CachedFolders(int courseId) => store.Get<List<CourseFolder>>(FoldersKey(courseId));

    public Task<Profile> ProfileAsync() => FetchAsync(ProfileKey, api.ProfileAsync);

    /// <summary>A score just got (and waiting to be sent): shown as the set's last score at once, online or not.</summary>
    public void SetLastScore(int quizId, double percent)
    {
        var score = Math.Round((decimal)percent, 2);
        if (store.Get<List<QuizSummary>>(QuizzesKey) is { } all && all.FirstOrDefault(q => q.Id == quizId) is { } summary)
        {
            summary.LastScore = score;
            store.Put(QuizzesKey, all);
        }
        if (CachedQuiz(quizId) is { } quiz)
        {
            quiz.LastScore = score;
            store.Put(QuizKey(quizId), quiz);
        }
    }

    /// <summary>
    /// Downloads ahead everything needed offline: the courses, every study set and exam, each course's files and folders,
    /// and the full content of every set that's ready (again only for those that changed). Sets that are gone are removed.
    /// </summary>
    public async Task DownloadAllAsync(CancellationToken ct = default)
    {
        var courses = await api.CoursesAsync();
        store.Put(CoursesKey, courses);
        var quizzes = await api.QuizzesAsync(null);
        store.Put(QuizzesKey, quizzes);
        connection.Report(true);

        foreach (var course in courses)
        {
            ct.ThrowIfCancellationRequested();
            store.Put(FilesKey(course.Id), await api.FilesAsync(course.Id));
            store.Put(FoldersKey(course.Id), await api.FoldersAsync(course.Id));
        }

        var ready = quizzes.Where(q => q.GenerationStatus == GenerationStatus.Success).ToList();
        foreach (var quiz in ready)
        {
            ct.ThrowIfCancellationRequested();
            // A regenerated set has new questions (new ids): what the list says tells whether the saved copy is still it.
            var fingerprint = Fingerprint(quiz);
            if (store.Meta($"fingerprint:{quiz.Id}") == fingerprint && CachedQuiz(quiz.Id) != null)
                continue;
            store.Put(QuizKey(quiz.Id), await api.QuizAsync(quiz.Id));
            store.SetMeta($"fingerprint:{quiz.Id}", fingerprint);
        }

        var keep = quizzes.Select(q => QuizKey(q.Id)).ToHashSet();
        foreach (var key in store.Keys("quiz:").Where(k => !keep.Contains(k)))
            store.Remove(key);
        var courseIds = courses.Select(c => c.Id).ToHashSet();
        foreach (var key in store.Keys("files:").Concat(store.Keys("folders:")).Where(k => !courseIds.Contains(int.Parse(k[(k.IndexOf(':') + 1)..]))))
            store.Remove(key);
    }

    static string Fingerprint(QuizSummary q) => $"{q.GenerationStatus}|{q.Name}|{string.Join(',', q.Questions.Select(x => x.Id))}";

    /// <summary>From the server (saving the answer); when it can't be reached, the saved copy if there is one.</summary>
    async Task<T> FetchAsync<T>(string key, Func<Task<T>> fetch) where T : class
    {
        try
        {
            var value = await fetch();
            store.Put(key, value);
            connection.Report(true);
            return value;
        }
        catch (ApiException e) when (e.IsOffline)
        {
            connection.Report(false);
            if (store.Get<T>(key) is { } cached)
                return cached;
            throw new ApiException("You're offline, and this hasn't been saved on this device yet. It will be once you're back online.");
        }
    }
}
