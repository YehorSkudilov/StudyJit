using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;

namespace StudyJit.Api.Controllers;

public record RegisterRequest(string Email, string Password, string Name);
public record LoginRequest(string Email, string Password);
public record RefreshRequest(string RefreshToken);

[Route("api/auth")]
[AllowAnonymous]
[EnableRateLimiting(RateLimits.Auth)]
public class AuthController(UserManager<AppUser> users, SignInManager<AppUser> signIn, TokenService tokens, TimeProvider clock) : ApiControllerBase
{
    /// <summary>Creates an account and signs it in.</summary>
    [HttpPost("register")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        var email = request.Email?.Trim() ?? "";
        var name = request.Name?.Trim() ?? "";
        if (email.Length == 0 || name.Length == 0 || string.IsNullOrEmpty(request.Password))
            return BadRequestError("Email, name, and password are required.");
        if (await users.FindByEmailAsync(email) != null)
            return ConflictError("An account with this email already exists.");

        var user = new AppUser { UserName = email, Email = email, Name = name, CreatedAt = clock.GetUtcNow() };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return BadRequestError(result.Errors.First().Description);
        return Ok(await tokens.IssueAsync(user, ct: ct));
    }

    [HttpPost("login")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var user = string.IsNullOrWhiteSpace(request.Email) ? null : await users.FindByEmailAsync(request.Email.Trim());
        if (user == null || string.IsNullOrEmpty(request.Password))
            return Error(StatusCodes.Status401Unauthorized, "Invalid email or password.");

        var result = await signIn.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
            return Error(StatusCodes.Status403Forbidden, Admin.AccountStatus.IsDisabled(user)
                ? "This account has been disabled."
                : "Too many wrong passwords. Try again in 15 minutes.");
        if (!result.Succeeded)
            return Error(StatusCodes.Status401Unauthorized, "Invalid email or password.");
        return Ok(await tokens.IssueAsync(user, ct: ct));
    }

    /// <summary>Exchanges a refresh token for a new access and refresh token. Each refresh token works once.</summary>
    [HttpPost("refresh")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Refresh(RefreshRequest request, CancellationToken ct)
    {
        var response = string.IsNullOrEmpty(request.RefreshToken) ? null : await tokens.RefreshAsync(request.RefreshToken, ct);
        return response == null ? Error(StatusCodes.Status401Unauthorized, "Your session has expired. Please sign in again.") : Ok(response);
    }

    /// <summary>Signs out the session the refresh token belongs to.</summary>
    [HttpPost("logout")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout(RefreshRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(request.RefreshToken))
            await tokens.RevokeAsync(request.RefreshToken, ct);
        return Ok(Success());
    }
}
