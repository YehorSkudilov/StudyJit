using StudyJit.Api.Data;

namespace StudyJit.Api.Admin;

/// <summary>
/// Who may use the admin site (StudyJit.AdminWeb). A role is a plain column on the user (<see cref="AppUser.AdminRole"/>)
/// that <see cref="Auth.TokenService"/> copies into the access token's "role" claim:
/// <list type="bullet">
///   <item><see cref="Admin"/>: sees every user, the stats and the generation queue, and can disable accounts, sign them
///   out and retry failed quizzes.</item>
///   <item><see cref="SuperAdmin"/>: all of that, plus changing roles, and deleting accounts.</item>
/// </list>
/// The first SuperAdmin comes from Admin__BootstrapEmails (see <see cref="AdminBootstrapper"/>).
/// </summary>
public static class AdminRoles
{
    public const string Admin = "Admin";
    public const string SuperAdmin = "SuperAdmin";

    public static bool IsValid(string? role) => role is Admin or SuperAdmin;
}

/// <summary>
/// A disabled account is locked out until the end of time: sign-in (Identity's lockout) and token refresh refuse it, and
/// disabling revokes its sessions, so it's out once its current access token expires. A shorter lockout is Identity's
/// own, after too many wrong passwords.
/// </summary>
public static class AccountStatus
{
    public const string Active = "Active";
    public const string Locked = "Locked";
    public const string Disabled = "Disabled";

    public static readonly DateTimeOffset DisabledUntil = DateTimeOffset.MaxValue;

    public static bool IsDisabled(AppUser user) => user.LockoutEnd is { } end && end.Year >= 9999;

    public static string Of(AppUser user, DateTimeOffset now) =>
        IsDisabled(user) ? Disabled : user.LockoutEnd is { } end && end > now ? Locked : Active;
}
