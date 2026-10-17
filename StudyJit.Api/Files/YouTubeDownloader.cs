using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;

namespace StudyJit.Api.Files;

/// <summary>
/// Downloads a video with yt-dlp (installed in the Docker image, with ffmpeg to merge video and audio) into the user's
/// folder, reporting progress as it goes.
/// </summary>
public partial class YouTubeDownloader(FileStorage storage, ILogger<YouTubeDownloader> log)
{
    /// <summary>
    /// Progress is 0–100 over the whole job: the video stream is the first half, audio up to 90, merging the rest.
    /// Returns the downloaded file's path, or throws an <see cref="InvalidOperationException"/> with a message safe to show.
    /// </summary>
    public async Task<string> DownloadAsync(string userId, string url, Func<double, Task> progress, CancellationToken ct)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
            throw new InvalidOperationException("That isn't a valid link.");

        var folder = storage.UserFolder(userId);
        var start = new ProcessStartInfo("yt-dlp")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var arg in new[]
        {
            uri.ToString(),
            "--output", Path.Combine(folder, "%(title)s.%(ext)s"),
            "--format", "bestvideo+bestaudio/best",
            "--merge-output-format", "mp4",
            "--remux-video", "mp4",
            "--postprocessor-args", "ffmpeg:-c:v copy -c:a aac -b:a 192k",
            "--restrict-filenames",
            "--no-playlist",
            "--no-warnings",
            "--newline",
            // The final path, after merging and moving, on its own line (--print implies --quiet, so ask for progress).
            "--print", "after_move:filepath",
            "--progress",
        })
            start.ArgumentList.Add(arg);

        Process process;
        try
        {
            process = Process.Start(start) ?? throw new InvalidOperationException("Couldn't start the downloader.");
        }
        catch (System.ComponentModel.Win32Exception e)
        {
            log.LogError(e, "yt-dlp isn't installed.");
            throw new InvalidOperationException("Downloading isn't available on this server.");
        }

        using (process)
        using (ct.Register(() => { try { process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } }))
        {
            string? finalPath = null;
            var errors = new List<string>();
            var phase = 0; // 0 video, 1 audio, 2 merging
            var firstDone = false;
            var gate = new SemaphoreSlim(1, 1);

            // Both streams carry lines worth reading, one at a time.
            async Task Handle(string line)
            {
                await gate.WaitAsync(ct);
                try
                {
                    var trimmed = line.Trim();
                    if (trimmed.StartsWith(folder, StringComparison.Ordinal) && File.Exists(trimmed))
                        finalPath = trimmed;
                    else if (line.StartsWith("ERROR", StringComparison.Ordinal))
                        errors.Add(line);
                    else if (line.Contains("[download] Destination:") && firstDone)
                        phase = Math.Max(phase, 1);
                    else if (line.Contains("[Merger]") || line.Contains("[VideoRemuxer]"))
                    {
                        phase = 2;
                        await progress(95);
                    }
                    else if (PercentPattern().Match(line) is { Success: true } m
                             && double.TryParse(m.Groups[1].Value, CultureInfo.InvariantCulture, out var percent))
                    {
                        if (percent >= 100)
                            firstDone = true;
                        var overall = phase switch { 0 => percent * 0.5, 1 => 50 + percent * 0.4, _ => 90 + percent * 0.1 };
                        await progress(Math.Min(overall, 99.5));
                    }
                }
                finally
                {
                    gate.Release();
                }
            }

            async Task Pump(StreamReader reader)
            {
                while (await reader.ReadLineAsync(ct) is { } line)
                    await Handle(line);
            }

            await Task.WhenAll(Pump(process.StandardOutput), Pump(process.StandardError));
            await process.WaitForExitAsync(ct);

            if (process.ExitCode != 0 || finalPath == null)
            {
                log.LogWarning("yt-dlp failed ({Code}) for {Url}: {Errors}", process.ExitCode, url, string.Join(" | ", errors));
                throw new InvalidOperationException("Download failed. Check the link and try again.");
            }
            return finalPath;
        }
    }

    [GeneratedRegex(@"\[download\]\s+([\d.]+)%")]
    private static partial Regex PercentPattern();
}
