using System.Net;
using StudyJit.Models;

namespace StudyJit.Services.Offline;

/// <summary>
/// Keeps the device and the server in step: sends what was saved on the device (answers, bests and scores, oldest
/// first), takes the account's practice history and bests from the server, and downloads ahead everything needed to
/// study offline. Runs when the app opens or comes back, when the connection returns, after signing in, a few seconds
/// after studying, and on pull to refresh. One run at a time; a run that can't reach the server stops and waits for
/// the next.
/// </summary>
public class SyncService(ApiClient api, AuthSession session, LocalStore store, StudyData data, ConnectionState connection)
{
    public const string AnswerKind = "answer", BestKind = "best", ScoreKind = "score";

    /// <summary>Most answers and bests sent in one request (the API takes up to 1,000).</summary>
    const int Batch = 500;

    readonly SemaphoreSlim _running = new(1, 1);
    CancellationTokenSource? _scheduled;
    // A scheduled run also downloads everything (not just sending what was studied) when any of its requests asked to.
    bool _downloadNext;

    /// <summary>Answers, bests and scores on the device that haven't reached the server yet.</summary>
    public int Pending => store.OutboxCount;

    /// <summary>A run finished (whether or not it got through): what's on screen may have changed.</summary>
    public event EventHandler? Synced;

    public void Start()
    {
        Connectivity.Current.ConnectivityChanged += (_, e) =>
        {
            if (e.NetworkAccess == NetworkAccess.Internet)
                Schedule(TimeSpan.FromSeconds(1), download: true);
        };
        // Signed in (or as someone else): their data comes down. Signed out: what's here goes.
        session.Changed += (_, _) =>
        {
            if (!session.IsSignedIn)
                store.Clear();
            else
                Schedule(TimeSpan.Zero, download: true);
        };
    }

    /// <summary>
    /// Runs after <paramref name="delay"/>; scheduling again before then moves it (several answers, one run). Studying only
    /// sends what was answered; <paramref name="download"/> (opening the app, coming back online) also downloads everything.
    /// </summary>
    public void Schedule(TimeSpan delay, bool download = false)
    {
        _scheduled?.Cancel();
        _downloadNext |= download;
        var cts = _scheduled = new CancellationTokenSource();
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(delay, cts.Token);
                var full = _downloadNext;
                _downloadNext = false;
                await SyncNowAsync(full);
            }
            catch (OperationCanceledException)
            {
            }
        });
    }

    /// <summary>A run now (or waits for the one under way and returns after it); <paramref name="download"/> as in <see cref="Schedule"/>.</summary>
    public async Task SyncNowAsync(bool download = true)
    {
        if (!_running.Wait(0))
        {
            await _running.WaitAsync();
            _running.Release();
            return;
        }
        try
        {
            await session.EnsureLoadedAsync();
            if (!session.IsSignedIn || session.UserId is not { } userId)
                return;
            // Another account's data (signed in as someone else while the app was closed): not theirs to see.
            if (store.Meta("owner") != userId)
            {
                store.Clear();
                store.SetMeta("owner", userId);
            }
            await SendAsync();
            if (download)
            {
                await ReceiveProgressAsync();
                await data.DownloadAllAsync();
                store.SetMeta("synced_at", DateTimeOffset.UtcNow.ToString("O"));
            }
            connection.Report(true);
        }
        catch (ApiException e) when (e.IsOffline)
        {
            connection.Report(false);
        }
        catch (Exception)
        {
            // The server refused something unexpected (or the session ended): the next run tries again.
        }
        finally
        {
            _running.Release();
            MainThread.BeginInvokeOnMainThread(() => Synced?.Invoke(this, EventArgs.Empty));
        }
    }

    /// <summary>Sends everything waiting, oldest first.</summary>
    async Task SendAsync()
    {
        while (store.Outbox(Batch) is { Count: > 0 } items)
        {
            var sent = new List<long>();
            // Scores one by one, in order (the last one is the set's last score).
            foreach (var item in items.Where(i => i.Kind == ScoreKind))
            {
                var score = LocalStore.Read<ScoreItem>(item);
                try
                {
                    await api.SaveScoreAsync(score.QuizId, score.Percent);
                }
                catch (ApiException e) when (!e.IsOffline && e.Status != HttpStatusCode.Unauthorized)
                {
                    // The set is gone (or the server won't take it): dropped, so it doesn't block everything after it.
                }
                sent.Add(item.Id);
            }
            var answers = items.Where(i => i.Kind == AnswerKind).ToList();
            var bests = items.Where(i => i.Kind == BestKind).ToList();
            if (answers.Count + bests.Count > 0)
            {
                await api.SaveProgressAsync(answers.Select(LocalStore.Read<StudyAnswerItem>), bests.Select(LocalStore.Read<StudyBestItem>));
                sent.AddRange(answers.Select(i => i.Id).Concat(bests.Select(i => i.Id)));
            }
            // Anything of a kind this version doesn't know (from a newer one) is dropped too.
            sent.AddRange(items.Where(i => i.Kind is not (ScoreKind or AnswerKind or BestKind)).Select(i => i.Id));
            store.Dequeue(sent);
        }
    }

    /// <summary>The account's history and bests (everything from here is in them now, from this and other devices and the website).</summary>
    async Task ReceiveProgressAsync()
    {
        var progress = await api.ProgressAsync();
        // Answered while this ran: not in the server's yet, so the server's copy waits for the next run.
        if (store.OutboxCount > 0)
            return;
        store.ReplaceHistory(progress.History.Select(h => (h.QuizId, h.Key, new HistoryEntry(h.Seen, h.Right, h.Wrong))));
        foreach (var best in progress.Bests)
            store.SetBestIfBetter(best.Key, best.Value, best.LowerIsBetter);
    }
}
