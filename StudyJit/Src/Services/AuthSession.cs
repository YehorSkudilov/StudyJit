using StudyJit.Models;

namespace StudyJit.Services;

/// <summary>
/// The signed-in account. The refresh token lives in the platform's secure storage (Keychain / Keystore /
/// DPAPI); the access token is short-lived and kept in memory only.
/// </summary>
public class AuthSession
{
    const string RefreshTokenKey = "auth.refresh_token";
    const string UserIdKey = "auth.user_id";
    const string EmailKey = "auth.email";
    const string NameKey = "auth.name";

    readonly Lazy<Task> _load;

    public AuthSession() => _load = new(LoadAsync);

    public string? UserId { get; private set; }
    public string? Email { get; private set; }
    public string? Name { get; private set; }
    public string? RefreshToken { get; private set; }
    public string? AccessToken { get; private set; }
    public DateTimeOffset AccessTokenExpiresAt { get; private set; }

    public bool IsSignedIn => RefreshToken != null;

    public event EventHandler? Changed;

    public Task EnsureLoadedAsync() => _load.Value;

    async Task LoadAsync()
    {
        try
        {
            RefreshToken = await SecureStorage.Default.GetAsync(RefreshTokenKey);
            UserId = await SecureStorage.Default.GetAsync(UserIdKey);
            Email = await SecureStorage.Default.GetAsync(EmailKey);
            Name = await SecureStorage.Default.GetAsync(NameKey);
        }
        catch (Exception)
        {
            // Secure storage can become unreadable (e.g. restored backup, reset keystore): start signed out.
            SecureStorage.Default.RemoveAll();
            RefreshToken = UserId = Email = Name = null;
        }
    }

    public async Task SetAsync(AuthResponse auth)
    {
        var changedAccount = auth.UserId != UserId;
        await SecureStorage.Default.SetAsync(RefreshTokenKey, auth.RefreshToken);
        await SecureStorage.Default.SetAsync(UserIdKey, auth.UserId);
        await SecureStorage.Default.SetAsync(EmailKey, auth.Email);
        await SecureStorage.Default.SetAsync(NameKey, auth.Name);
        (RefreshToken, UserId, Email, Name) = (auth.RefreshToken, auth.UserId, auth.Email, auth.Name);
        (AccessToken, AccessTokenExpiresAt) = (auth.AccessToken, auth.AccessTokenExpiresAt);
        // A token renewal is the same account: nothing on screen needs to change.
        if (changedAccount)
            Changed?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>After the profile's name or email changed; the tokens stay valid.</summary>
    public async Task SetProfileAsync(string name, string email)
    {
        await SecureStorage.Default.SetAsync(NameKey, name);
        await SecureStorage.Default.SetAsync(EmailKey, email);
        (Name, Email) = (name, email);
        Changed?.Invoke(this, EventArgs.Empty);
    }

    public void Clear()
    {
        SecureStorage.Default.Remove(RefreshTokenKey);
        SecureStorage.Default.Remove(UserIdKey);
        SecureStorage.Default.Remove(EmailKey);
        SecureStorage.Default.Remove(NameKey);
        RefreshToken = UserId = Email = Name = AccessToken = null;
        Changed?.Invoke(this, EventArgs.Empty);
    }
}
