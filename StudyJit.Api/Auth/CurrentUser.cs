namespace StudyJit.Api.Auth;

/// <summary>The signed-in user of this request (the access token's "sub").</summary>
public interface ICurrentUser
{
    string Id { get; }
}

public class HttpCurrentUser(IHttpContextAccessor http) : ICurrentUser
{
    public string Id => http.HttpContext?.User.FindFirst("sub")?.Value
        ?? throw new InvalidOperationException("No signed-in user on this request.");
}
