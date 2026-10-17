using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Data;

namespace StudyJit.Api.Quizzes;

/// <summary>
/// Quizzes waiting for generation, worked through one at a time by <see cref="QuizGenerationWorker"/> (each is a slow,
/// paid OpenAI call). The order lives here; each quiz's QueueNumber in the database mirrors it for the web app to show.
/// </summary>
public class QuizGenerationQueue(IServiceScopeFactory scopes)
{
    readonly object _lock = new();
    readonly List<int> _waiting = [];
    readonly SemaphoreSlim _signal = new(0);
    int? _running;

    /// <summary>Queues a quiz unless it's already queued or running; returns its place in the queue (0 while running).</summary>
    public async Task<int> EnqueueAsync(int quizId, CancellationToken ct = default)
    {
        int place;
        lock (_lock)
        {
            if (_running == quizId)
                return 0;
            if (!_waiting.Contains(quizId))
            {
                _waiting.Add(quizId);
                _signal.Release();
            }
            place = _waiting.IndexOf(quizId) + 1;
        }
        await RenumberAsync(ct);
        return place;
    }

    public async Task<int> DequeueAsync(CancellationToken ct)
    {
        await _signal.WaitAsync(ct);
        lock (_lock)
        {
            var next = _waiting[0];
            _waiting.RemoveAt(0);
            _running = next;
            return next;
        }
    }

    public void Finished()
    {
        lock (_lock)
            _running = null;
    }

    /// <summary>What's running and what's waiting, in order.</summary>
    public (int? Running, int[] Waiting) Snapshot()
    {
        lock (_lock)
            return (_running, _waiting.ToArray());
    }

    /// <summary>Writes each waiting quiz's place to the database.</summary>
    public async Task RenumberAsync(CancellationToken ct = default)
    {
        int[] waiting;
        lock (_lock)
            waiting = _waiting.ToArray();
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        for (var i = 0; i < waiting.Length; i++)
        {
            var id = waiting[i];
            var place = i + 1;
            await db.Quizzes.Where(q => q.Id == id && q.GenerationStatus == GenerationStatus.Queued)
                .ExecuteUpdateAsync(s => s.SetProperty(q => q.QueueNumber, place), ct);
        }
    }
}

/// <summary>Generates queued quizzes one after another. At startup it picks up quizzes left queued or running by a restart.</summary>
public class QuizGenerationWorker(QuizGenerationQueue queue, IServiceScopeFactory scopes, ILogger<QuizGenerationWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            using (var scope = scopes.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
                var left = await db.Quizzes
                    .Where(q => q.GenerationStatus == GenerationStatus.Queued || q.GenerationStatus == GenerationStatus.Pending)
                    .OrderBy(q => q.GenerationStatus == GenerationStatus.Pending ? 0 : 1).ThenBy(q => q.QueueNumber).ThenBy(q => q.Id)
                    .Select(q => q.Id).ToListAsync(stoppingToken);
                if (left.Count > 0)
                    log.LogInformation("Picking up {Count} quiz(es) left in the generation queue.", left.Count);
                foreach (var id in left)
                {
                    await db.Quizzes.Where(q => q.Id == id).ExecuteUpdateAsync(s => s.SetProperty(q => q.GenerationStatus, GenerationStatus.Queued), stoppingToken);
                    await queue.EnqueueAsync(id, stoppingToken);
                }
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                var quizId = await queue.DequeueAsync(stoppingToken);
                try
                {
                    await queue.RenumberAsync(stoppingToken);
                    using var scope = scopes.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<QuizGenerator>().GenerateAsync(quizId, stoppingToken);
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    log.LogError(e, "Generating quiz {QuizId} failed unexpectedly.", quizId);
                }
                finally
                {
                    queue.Finished();
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down: whatever was queued or running is picked up again at the next start.
        }
    }
}
