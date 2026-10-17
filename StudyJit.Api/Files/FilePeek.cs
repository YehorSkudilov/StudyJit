using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;

namespace StudyJit.Api.Files;

/// <summary>
/// A quick look inside a file for its title and opening words, so the AI can tell what a file covers when its name
/// doesn't say (e.g. "Lecture_03_final.pdf"). Best effort and cheap: a file it can't read just gives nothing.
/// </summary>
public static partial class FilePeek
{
    const int MaxChars = 400;
    /// <summary>How much of a PDF is read looking for text; titles are near the start.</summary>
    const int MaxPdfBytes = 4 * 1024 * 1024;

    static readonly string[] TextExtensions = [".txt", ".md", ".csv", ".html", ".htm", ".json", ".xml", ".rtf"];

    public static async Task<string?> PeekAsync(string path, string name, CancellationToken ct)
    {
        if (!File.Exists(path))
            return null;
        try
        {
            var ext = Path.GetExtension(name).ToLowerInvariant();
            var text = ext switch
            {
                _ when TextExtensions.Contains(ext) => await ReadTextAsync(path, ct),
                ".docx" => FromOffice(path, "word/document.xml", "w:t"),
                ".pptx" => FromOffice(path, "ppt/slides/slide1.xml", "a:t"),
                ".pdf" => await FromPdfAsync(path, ct),
                _ => null,
            };
            return Tidy(text);
        }
        catch (Exception e) when (e is IOException or InvalidDataException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    static async Task<string> ReadTextAsync(string path, CancellationToken ct)
    {
        using var reader = new StreamReader(path);
        var buffer = new char[MaxChars * 2];
        var read = await reader.ReadBlockAsync(buffer.AsMemory(), ct);
        return StripTags().Replace(new string(buffer, 0, read), " ");
    }

    /// <summary>Word and PowerPoint files are zips of XML: the document title, then the first page's or slide's text.</summary>
    static string FromOffice(string path, string body, string textTag)
    {
        using var zip = ZipFile.OpenRead(path);
        var parts = new List<string>();
        if (zip.GetEntry("docProps/core.xml") is { } core)
        {
            var title = Regex.Match(ReadEntry(core), "<dc:title>([^<]*)</dc:title>").Groups[1].Value;
            if (title.Trim().Length > 0)
                parts.Add($"Title: {title.Trim()}");
        }
        if (zip.GetEntry(body) is { } entry)
        {
            var runs = Regex.Matches(ReadEntry(entry), $"<{textTag}(?: [^>]*)?>([^<]*)</{textTag}>").Select(m => m.Groups[1].Value);
            parts.Add(string.Join(" ", runs));
        }
        return System.Net.WebUtility.HtmlDecode(string.Join(" — ", parts.Select(p => p.Trim()).Where(p => p.Length > 0)));
    }

    static string ReadEntry(ZipArchiveEntry entry)
    {
        using var reader = new StreamReader(entry.Open());
        var buffer = new char[200_000];
        var read = reader.ReadBlock(buffer, 0, buffer.Length);
        return new string(buffer, 0, read);
    }

    /// <summary>A PDF's Title field if it has one, then text from its first content streams.</summary>
    static async Task<string> FromPdfAsync(string path, CancellationToken ct)
    {
        byte[] bytes;
        await using (var file = File.OpenRead(path))
        {
            bytes = new byte[Math.Min(file.Length, MaxPdfBytes)];
            await file.ReadExactlyAsync(bytes, ct);
        }
        var raw = Encoding.Latin1.GetString(bytes);
        var parts = new List<string>();
        var title = PdfTitle().Match(raw);
        var titleText = !title.Success ? "" : title.Groups[1].Success ? PdfString(title.Groups[1].Value) : PdfHexString(title.Groups[2].Value);
        if (titleText.Length > 0 && !PlaceholderTitle().IsMatch(titleText))
            parts.Add($"Title: {titleText}");

        var text = new StringBuilder();
        foreach (Match stream in PdfStream().Matches(raw))
        {
            if (text.Length > MaxChars)
                break;
            var start = stream.Index + stream.Length;
            var end = raw.IndexOf("endstream", start, StringComparison.Ordinal);
            if (end < 0)
                break;
            var filters = stream.Groups[1].Value;
            byte[]? data = bytes[start..end];
            if (filters.Contains("/ASCII85Decode"))
                data = Ascii85(raw[start..end]);
            var content = data == null ? null : filters.Contains("/FlateDecode") ? Inflate(data) : Encoding.Latin1.GetString(data);
            if (content == null)
                continue;
            foreach (Match shown in PdfShownText().Matches(content))
            {
                foreach (Match literal in PdfLiteral().Matches(shown.Value))
                    text.Append(PdfString(literal.Groups[1].Value));
                text.Append(' ');
            }
            text.Append(' ');
        }
        parts.Add(text.ToString());
        return string.Join(" — ", parts.Select(p => p.Trim()).Where(p => p.Length > 0));
    }

    static string? Inflate(byte[] data)
    {
        try
        {
            using var input = new MemoryStream(data);
            using var zlib = new ZLibStream(input, CompressionMode.Decompress);
            using var reader = new StreamReader(zlib, Encoding.Latin1);
            var buffer = new char[100_000];
            var read = reader.ReadBlock(buffer, 0, buffer.Length);
            return new string(buffer, 0, read);
        }
        catch (InvalidDataException)
        {
            return null;
        }
    }

    /// <summary>Undoes ASCII85 (the "&lt;~ ... ~&gt;" text encoding some PDF writers put streams in).</summary>
    static byte[]? Ascii85(string text)
    {
        var body = text.Trim();
        if (body.StartsWith("<~"))
            body = body[2..];
        var endMark = body.IndexOf("~>", StringComparison.Ordinal);
        if (endMark >= 0)
            body = body[..endMark];
        var output = new List<byte>(body.Length);
        var group = new List<int>(5);
        foreach (var c in body)
        {
            if (char.IsWhiteSpace(c))
                continue;
            if (c == 'z' && group.Count == 0)
            {
                output.AddRange([0, 0, 0, 0]);
                continue;
            }
            if (c < '!' || c > 'u')
                return null;
            group.Add(c - '!');
            if (group.Count == 5)
            {
                output.AddRange(Ascii85Group(group, 4));
                group.Clear();
            }
        }
        if (group.Count > 0)
        {
            var take = group.Count - 1;
            while (group.Count < 5)
                group.Add(84);
            output.AddRange(Ascii85Group(group, take));
        }
        return output.ToArray();
    }

    static IEnumerable<byte> Ascii85Group(List<int> group, int take)
    {
        uint value = 0;
        foreach (var digit in group)
            value = value * 85 + (uint)digit;
        return new[] { (byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value }.Take(take);
    }

    /// <summary>A hex PDF string: UTF-16 when it starts with a byte-order mark (as titles often do), Latin-1 otherwise.</summary>
    static string PdfHexString(string hex)
    {
        var digits = new string(hex.Where(Uri.IsHexDigit).ToArray());
        if (digits.Length % 2 == 1)
            digits += "0";
        var data = Convert.FromHexString(digits);
        return (data.Length >= 2 && data[0] == 0xFE && data[1] == 0xFF ? Encoding.BigEndianUnicode.GetString(data, 2, data.Length - 2) : Encoding.Latin1.GetString(data)).Trim();
    }

    /// <summary>A PDF literal string's text, with its escapes undone (good enough for plain titles).</summary>
    static string PdfString(string value) =>
        PdfEscape().Replace(value, m => m.Groups[1].Value switch { "n" => " ", "r" => " ", "t" => " ", var c => c }).Trim();

    static string? Tidy(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;
        var clean = Whitespace().Replace(new string(text.Where(c => !char.IsControl(c) || c == ' ').ToArray()), " ").Trim();
        // Text that's mostly symbols is an encoding we couldn't read, not words.
        if (clean.Length == 0 || clean.Count(char.IsLetter) < clean.Length / 3)
            return null;
        return clean.Length > MaxChars ? clean[..MaxChars] : clean;
    }

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex StripTags();

    [GeneratedRegex(@"/Title\s*(?:\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]+)>)")]
    private static partial Regex PdfTitle();

    /// <summary>Titles writers fill in by default, which say nothing about the file.</summary>
    [GeneratedRegex(@"^(untitled|microsoft (word|powerpoint)|presentation\d*|document\d*|slide \d+)", RegexOptions.IgnoreCase)]
    private static partial Regex PlaceholderTitle();

    [GeneratedRegex(@"<<([^>]*)>>\s*stream\r?\n")]
    private static partial Regex PdfStream();

    [GeneratedRegex(@"(\((?:[^()\\]|\\.)*\)\s*Tj|\[(?:[^\]])*\]\s*TJ)")]
    private static partial Regex PdfShownText();

    [GeneratedRegex(@"\(((?:[^()\\]|\\.)*)\)")]
    private static partial Regex PdfLiteral();

    [GeneratedRegex(@"\\(.)")]
    private static partial Regex PdfEscape();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
