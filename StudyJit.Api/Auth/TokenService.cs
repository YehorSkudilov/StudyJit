using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using StudyJit.Api.Admin;
using StudyJit.Api.Data;

namespace StudyJit.Api.Auth;

public class JwtOptions
{
    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";

    /// <summary>HMAC-SHA256 key, from Jwt__SigningKey in .env.</summary>
    public string SigningKey { get; set; } = "";

    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 30;

    public SymmetricSecurityKey Key => new(Encoding.UTF8.GetBytes(SigningKey));

    /// <summary>Fails startup rather than running with a missing or guessable key.</summary>
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Issuer) || string.IsNullOrWhiteSpace(Audience))
            throw new InvalidOperationException("Jwt:Issuer and Jwt:Audience must be configured.");
        if (Encoding.UTF8.GetByteCount(SigningKey) < 32)
            throw new InvalidOperationException("Jwt:SigningKey must be at least 32 bytes. Set it with the Jwt__SigningKey environment variable.");
        if (AccessTokenMinutes is < 1 or > 60 || RefreshTokenDays is < 1 or > 90)
            throw new InvalidOperationException("Jwt token lifetimes are out of range.");
    }
}

public class AuthResponse
{
    public string UserId { get; set; } = "";
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string AccessToken { get; set; } = "";
    public DateTimeOffset AccessTokenExpiresAt { get; set; }
    public string RefreshToken { get; set; } = "";
    public DateTimeOffset RefreshTokenExpiresAt { get; set; }
}

/// <summary>
/// Issues short-lived JWT access tokens and opaque, rotating refresh tokens. Refresh tokens are stored only
/// as hashes; presenting one that was already rotated is treated as theft and revokes the whole family.
/// </summary>
public class TokenService(JwtOptions options, ApiDbContext db, TimeProvider clock)
{
    public async Task<AuthResponse> IssueAsync(AppUser user, Guid? familyId = null, CancellationToken ct = default)
    {
        var now = clock.GetUtcNow();
        var accessExpires = now.AddMinutes(options.AccessTokenMinutes);
        var claims = new Dictionary<string, object>
        {
            [JwtRegisteredClaimNames.Sub] = user.Id,
            [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString("N"),
        };
        // Read from the database on every sign-in and refresh, so a role change reaches the admin site within one
        // access token lifetime.
        if (AdminRoles.IsValid(user.AdminRole))
            claims[AuthPolicies.RoleClaim] = user.AdminRole!;
        var accessToken = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = accessExpires.UtcDateTime,
            Claims = claims,
            SigningCredentials = new SigningCredentials(options.Key, SecurityAlgorithms.HmacSha256),
        });

        var refreshToken = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        var refreshExpires = now.AddDays(options.RefreshTokenDays);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = Hash(refreshToken),
            FamilyId = familyId ?? Guid.NewGuid(),
            CreatedAt = now,
            ExpiresAt = refreshExpires,
        });
        await db.SaveChangesAsync(ct);

        return new AuthResponse
        {
            UserId = user.Id,
            Email = user.Email ?? "",
            Name = user.Name,
            AccessToken = accessToken,
            AccessTokenExpiresAt = accessExpires,
            RefreshToken = refreshToken,
            RefreshTokenExpiresAt = refreshExpires,
        };
    }

    /// <summary>Exchanges a refresh token for a new pair. Returns null for anything invalid, expired, revoked or reused.</summary>
    public async Task<AuthResponse?> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var now = clock.GetUtcNow();
        var hash = Hash(refreshToken);
        var stored = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored == null)
            return null;

        if (stored.RevokedAt != null)
        {
            // A token that was already exchanged is being replayed: someone else may hold this session.
            await RevokeFamilyAsync(stored.FamilyId, ct);
            return null;
        }
        if (stored.ExpiresAt <= now)
            return null;

        // Claim the token atomically so two concurrent refreshes with the same token can't both succeed.
        var claimed = await db.RefreshTokens
            .Where(t => t.Id == stored.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
        if (claimed == 0)
        {
            await RevokeFamilyAsync(stored.FamilyId, ct);
            return null;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == stored.UserId, ct);
        if (user == null || (user.LockoutEnd != null && user.LockoutEnd > now))
            return null;
        return await IssueAsync(user, stored.FamilyId, ct);
    }

    /// <summary>Signs out the session the token belongs to. Unknown tokens are ignored.</summary>
    public async Task RevokeAsync(string refreshToken, CancellationToken ct = default)
    {
        var hash = Hash(refreshToken);
        var familyId = await db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => (Guid?)t.FamilyId).FirstOrDefaultAsync(ct);
        if (familyId != null)
            await RevokeFamilyAsync(familyId.Value, ct);
    }

    /// <summary>Signs the user out everywhere, e.g. after the password changed.</summary>
    public Task RevokeAllAsync(string userId, CancellationToken ct = default)
    {
        var now = clock.GetUtcNow();
        return db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }

    Task RevokeFamilyAsync(Guid familyId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        return db.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }

    static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

public static class AuthPolicies
{
    /// <summary>In the access token of admins only: their <see cref="AppUser.AdminRole"/>.</summary>
    public const string RoleClaim = "role";

    /// <summary>The admin site's endpoints: an Admin or SuperAdmin.</summary>
    public const string AdminAccess = "admin-access";

    /// <summary>What only a SuperAdmin may do: change roles, delete accounts, clear the OpenAI account.</summary>
    public const string SuperAdminOnly = "super-admin-only";

    /// <summary>Shortest password allowed (length over composition rules, NIST SP 800-63B).</summary>
    public const int MinPasswordLength = 8;
}
