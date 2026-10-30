namespace StudyJit.Services.Offline;

/// <summary>
/// Whether the server can be reached right now, as the last call to it found (the platform's own network status says
/// little: a café's wifi with a sign-in page counts as "connected"). The tabs show a pill while offline.
/// </summary>
public class ConnectionState
{
    public bool IsOffline { get; private set; }

    public event EventHandler? Changed;

    /// <summary>A call to the server got through (<paramref name="reached"/>) or couldn't reach it.</summary>
    public void Report(bool reached)
    {
        if (IsOffline == !reached)
            return;
        IsOffline = !reached;
        MainThread.BeginInvokeOnMainThread(() => Changed?.Invoke(this, EventArgs.Empty));
    }
}
