using System.Net.Security;
using System.Reflection;

namespace StudyJit.Services;

/// <summary>Where the app finds the StudyJit API and website.</summary>
public static class ApiConfig
{
    // Baked in at build time from the ApiBaseUrl MSBuild property / API_BASE_URL environment variable /
    // StudyJit/.env, via [AssemblyMetadata] - see StudyJit.csproj. No fallback: the build itself fails if it's unset.
    public static Uri BaseAddress { get; } = new(Metadata("ApiBaseUrl")
        ?? throw new InvalidOperationException("ApiBaseUrl assembly metadata is missing - this build should have failed at compile time."));

    /// <summary>The website, for links out of the app; null when the build wasn't given one.</summary>
    public static Uri? WebAddress { get; } = Uri.TryCreate(Metadata("WebBaseUrl"), UriKind.Absolute, out var web) ? web : null;

    static string? Metadata(string key) =>
        typeof(ApiConfig).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == key)?.Value is { Length: > 0 } value
            ? value
            : null;

    public static HttpClient CreateClient()
    {
        if (BaseAddress.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("The API must be reached over HTTPS.");

        var handler = new HttpClientHandler();
#if DEBUG
        // Debug builds only: accept the ASP.NET Core development certificate of the local API, which the
        // emulator doesn't trust and whose name doesn't match 10.0.2.2. Release builds keep full validation.
        handler.ServerCertificateCustomValidationCallback = (request, _, _, errors) =>
            errors == SslPolicyErrors.None || request.RequestUri?.Host is "localhost" or "10.0.2.2";
#endif
        // Long enough for the AI's answers (reading a course list, sorting files, marking an answer).
        return new HttpClient(handler) { BaseAddress = BaseAddress, Timeout = TimeSpan.FromSeconds(150) };
    }
}
