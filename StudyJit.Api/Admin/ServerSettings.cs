using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Data;

namespace StudyJit.Api.Admin;

/// <summary>
/// Settings admins change from the admin site while the server runs, kept in the database. A setting nobody has
/// changed has its default.
/// </summary>
public class ServerSettings(ApiDbContext db, TimeProvider time)
{
    const string SignUpEnabledKey = "signup.enabled";

    /// <summary>Anyone may register on the website. Off: only admins create accounts (from the admin site).</summary>
    public async Task<bool> SignUpEnabledAsync(CancellationToken ct) => await GetAsync(SignUpEnabledKey, ct) != "false";

    public Task SetSignUpEnabledAsync(bool enabled, CancellationToken ct) => SetAsync(SignUpEnabledKey, enabled ? "true" : "false", ct);

    async Task<string?> GetAsync(string key, CancellationToken ct) =>
        await db.Settings.Where(s => s.Key == key).Select(s => s.Value).FirstOrDefaultAsync(ct);

    async Task SetAsync(string key, string value, CancellationToken ct)
    {
        var row = await db.Settings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row == null)
            db.Settings.Add(row = new ServerSetting { Key = key });
        row.Value = value;
        row.UpdatedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);
    }
}
