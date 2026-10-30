using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace StudyJit.Services.Offline;

/// <summary>How a question has gone on this account: when it last came up, how often right and wrong.</summary>
public record HistoryEntry(DateTimeOffset Seen, int Right, int Wrong);

/// <summary>Something done offline (or not sent yet) waiting to go to the server, oldest first.</summary>
public record OutboxItem(long Id, string Kind, string Json);

/// <summary>
/// The app's database on the device (SQLite), so everything can be studied without a connection:
/// <list type="bullet">
///   <item><c>cache</c>: the API's answers as JSON by what they are ("courses", "quiz:12"), shown when offline and
///   before the fresh copy arrives (see <see cref="StudyData"/>).</item>
///   <item><c>outbox</c>: answers, bests and scores not on the server yet, sent by <see cref="SyncService"/>.</item>
///   <item><c>history</c> and <c>bests</c>: practice history (new and missed questions first) and personal bests, the
///   server's merged with what's still in the outbox.</item>
///   <item><c>meta</c>: whose data this is, and when it was last synced.</item>
/// </list>
/// Everything belongs to one account: <see cref="Clear"/> on signing out or in as someone else.
/// </summary>
public sealed class LocalStore : IDisposable
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    readonly SqliteConnection _db;
    readonly Lock _lock = new();

    public LocalStore(string path)
    {
        _db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path }.ToString());
        _db.Open();
        Execute("""
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, json TEXT NOT NULL, created_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS history (quiz_id INTEGER NOT NULL, key TEXT NOT NULL, seen INTEGER NOT NULL, right INTEGER NOT NULL,
                wrong INTEGER NOT NULL, PRIMARY KEY (quiz_id, key));
            CREATE TABLE IF NOT EXISTS bests (key TEXT PRIMARY KEY, value REAL NOT NULL, lower_is_better INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            """);
    }

    public void Dispose() => _db.Dispose();

    // ---------- Cached API answers ----------

    public T? Get<T>(string key) where T : class
    {
        var json = Scalar<string>("SELECT json FROM cache WHERE key = $key", ("$key", key));
        if (json == null)
            return null;
        try
        {
            return JsonSerializer.Deserialize<T>(json, Json);
        }
        catch (JsonException)
        {
            // Saved by an older version in a shape this one doesn't read: fetched again next time.
            return null;
        }
    }

    public void Put<T>(string key, T value) =>
        Execute("INSERT OR REPLACE INTO cache (key, json, updated_at) VALUES ($key, $json, $at)",
            ("$key", key), ("$json", JsonSerializer.Serialize(value, Json)), ("$at", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));

    public void Remove(string key) => Execute("DELETE FROM cache WHERE key = $key", ("$key", key));

    /// <summary>The keys saved that start with <paramref name="prefix"/>, e.g. every "quiz:".</summary>
    public List<string> Keys(string prefix) =>
        Rows("SELECT key FROM cache WHERE key LIKE $prefix ESCAPE '\\'", r => r.GetString(0), ("$prefix", Like(prefix) + "%"));

    static string Like(string text) => text.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    // ---------- Things waiting for the server ----------

    public void Enqueue(string kind, object payload) =>
        Execute("INSERT INTO outbox (kind, json, created_at) VALUES ($kind, $json, $at)",
            ("$kind", kind), ("$json", JsonSerializer.Serialize(payload, payload.GetType(), Json)), ("$at", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));

    public List<OutboxItem> Outbox(int limit) =>
        Rows("SELECT id, kind, json FROM outbox ORDER BY id LIMIT $limit", r => new OutboxItem(r.GetInt64(0), r.GetString(1), r.GetString(2)), ("$limit", limit));

    public int OutboxCount => (int)(Scalar<long?>("SELECT COUNT(*) FROM outbox") ?? 0);

    public void Dequeue(IEnumerable<long> ids)
    {
        lock (_lock)
        {
            using var transaction = _db.BeginTransaction();
            foreach (var id in ids)
            {
                using var command = Command("DELETE FROM outbox WHERE id = $id", ("$id", id));
                command.ExecuteNonQuery();
            }
            transaction.Commit();
        }
    }

    public static T Read<T>(OutboxItem item) => JsonSerializer.Deserialize<T>(item.Json, Json)!;

    // ---------- Practice history ----------

    public Dictionary<string, HistoryEntry> History(int quizId) =>
        Rows("SELECT key, seen, right, wrong FROM history WHERE quiz_id = $quiz",
                r => (Key: r.GetString(0), Entry: new HistoryEntry(DateTimeOffset.FromUnixTimeMilliseconds(r.GetInt64(1)), r.GetInt32(2), r.GetInt32(3))),
                ("$quiz", quizId))
            .ToDictionary(x => x.Key, x => x.Entry);

    public void RecordAnswer(int quizId, string key, bool correct, DateTimeOffset at) =>
        Execute("""
            INSERT INTO history (quiz_id, key, seen, right, wrong) VALUES ($quiz, $key, $seen, $right, $wrong)
            ON CONFLICT (quiz_id, key) DO UPDATE SET seen = MAX(seen, excluded.seen), right = right + excluded.right, wrong = wrong + excluded.wrong
            """, ("$quiz", quizId), ("$key", key), ("$seen", at.ToUnixTimeMilliseconds()), ("$right", correct ? 1 : 0), ("$wrong", correct ? 0 : 1));

    /// <summary>The server's history in place of what's here (once everything here has reached it, so nothing is lost).</summary>
    public void ReplaceHistory(IEnumerable<(int QuizId, string Key, HistoryEntry Entry)> rows)
    {
        lock (_lock)
        {
            using var transaction = _db.BeginTransaction();
            using (var clear = Command("DELETE FROM history"))
                clear.ExecuteNonQuery();
            foreach (var (quizId, key, e) in rows)
            {
                using var insert = Command("INSERT OR REPLACE INTO history (quiz_id, key, seen, right, wrong) VALUES ($quiz, $key, $seen, $right, $wrong)",
                    ("$quiz", quizId), ("$key", key), ("$seen", e.Seen.ToUnixTimeMilliseconds()), ("$right", e.Right), ("$wrong", e.Wrong));
                insert.ExecuteNonQuery();
            }
            transaction.Commit();
        }
    }

    // ---------- Personal bests ----------

    public double? Best(string key) => Scalar<double?>("SELECT value FROM bests WHERE key = $key", ("$key", key));

    /// <summary>Keeps <paramref name="value"/> if it beats the one here (or there's none). True when it did.</summary>
    public bool SetBestIfBetter(string key, double value, bool lowerIsBetter)
    {
        lock (_lock)
        {
            var best = Best(key);
            if (best != null && (lowerIsBetter ? value >= best : value <= best))
                return false;
            Execute("INSERT OR REPLACE INTO bests (key, value, lower_is_better) VALUES ($key, $value, $lower)",
                ("$key", key), ("$value", value), ("$lower", lowerIsBetter ? 1 : 0));
            return true;
        }
    }

    // ---------- Whose data, when synced ----------

    public string? Meta(string key) => Scalar<string>("SELECT value FROM meta WHERE key = $key", ("$key", key));

    public void SetMeta(string key, string value) =>
        Execute("INSERT OR REPLACE INTO meta (key, value) VALUES ($key, $value)", ("$key", key), ("$value", value));

    /// <summary>Everything gone: signed out, or another account's data is coming.</summary>
    public void Clear() => Execute("DELETE FROM cache; DELETE FROM outbox; DELETE FROM history; DELETE FROM bests; DELETE FROM meta;");

    // ---------- Plumbing ----------

    SqliteCommand Command(string sql, params (string Name, object? Value)[] parameters)
    {
        var command = _db.CreateCommand();
        command.CommandText = sql;
        foreach (var (name, value) in parameters)
            command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        return command;
    }

    void Execute(string sql, params (string, object?)[] parameters)
    {
        lock (_lock)
        {
            using var command = Command(sql, parameters);
            command.ExecuteNonQuery();
        }
    }

    T? Scalar<T>(string sql, params (string, object?)[] parameters)
    {
        lock (_lock)
        {
            using var command = Command(sql, parameters);
            var value = command.ExecuteScalar();
            if (value is null or DBNull)
                return default;
            var type = Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T);
            return (T)Convert.ChangeType(value, type);
        }
    }

    List<T> Rows<T>(string sql, Func<SqliteDataReader, T> read, params (string, object?)[] parameters)
    {
        lock (_lock)
        {
            using var command = Command(sql, parameters);
            using var reader = command.ExecuteReader();
            var rows = new List<T>();
            while (reader.Read())
                rows.Add(read(reader));
            return rows;
        }
    }
}
