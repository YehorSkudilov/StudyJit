namespace StudyJit.Api.Files;

public class StorageOptions
{
    /// <summary>Where uploaded files are kept: a Docker volume at /shared-files on the server (see docker-compose.yml).</summary>
    public string Root { get; set; } = "storage";
}

/// <summary>Uploaded and downloaded files on disk, one folder per user so equal names never collide.</summary>
public class FileStorage(StorageOptions options, ILogger<FileStorage> log)
{
    public string Root { get; } = Path.GetFullPath(options.Root);

    public string UserFolder(string userId)
    {
        var folder = Path.Combine(Root, userId);
        Directory.CreateDirectory(folder);
        return folder;
    }

    /// <summary>The path for a file the user names, kept inside their folder whatever the name holds.</summary>
    public string PathFor(string userId, string fileName) => Path.Combine(UserFolder(userId), SafeName(fileName));

    public static string SafeName(string fileName)
    {
        var name = Path.GetFileName(fileName.Replace('\\', '/'));
        foreach (var c in Path.GetInvalidFileNameChars())
            name = name.Replace(c, '_');
        name = name.Trim().TrimStart('.');
        return name.Length == 0 ? "file" : name.Length > 200 ? name[..200] : name;
    }

    /// <summary>Removes a file if it's under the storage root; a missing file is fine.</summary>
    public void Delete(string path)
    {
        var full = Path.GetFullPath(path);
        if (!full.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        {
            log.LogWarning("Not deleting {Path}: outside the storage root.", path);
            return;
        }
        try
        {
            File.Delete(full);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            log.LogWarning(e, "Couldn't delete {Path}.", full);
        }
    }

    public void DeleteUserFolder(string userId)
    {
        var folder = Path.Combine(Root, userId);
        try
        {
            if (Directory.Exists(folder))
                Directory.Delete(folder, recursive: true);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            log.LogWarning(e, "Couldn't delete {Folder}.", folder);
        }
    }

    public static string? MimeTypeOf(string fileName) => Path.GetExtension(fileName).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".txt" => "text/plain",
        ".md" => "text/markdown",
        ".csv" => "text/csv",
        ".json" => "application/json",
        ".html" or ".htm" => "text/html",
        ".xml" => "application/xml",
        ".doc" => "application/msword",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".ppt" => "application/vnd.ms-powerpoint",
        ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".webp" => "image/webp",
        ".mp3" => "audio/mpeg",
        ".m4a" => "audio/mp4",
        ".wav" => "audio/wav",
        ".mp4" => "video/mp4",
        ".webm" => "video/webm",
        _ => null,
    };
}
