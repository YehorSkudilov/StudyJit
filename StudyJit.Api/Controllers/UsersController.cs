using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;

namespace StudyJit.Api.Controllers;

public record ProfileResponse(string Id, string Name, string Email, string? Bio);

public record UpdateProfileRequest(string? Name, string? Email, string? Bio, string? CurrentPassword, string? NewPassword);

public record MessageResponse(string Message);

/// <summary>The signed-in user's own profile.</summary>
[Route("api/users")]
public class UsersController(UserManager<AppUser> users, ICurrentUser me, TokenService tokens) : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType<ProfileResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get()
    {
        var user = await users.FindByIdAsync(me.Id);
        if (user == null)
            return NotFoundError("User not found.");
        return Ok(new ProfileResponse(user.Id, user.Name, user.Email ?? "", user.Bio));
    }

    /// <summary>Changes the name, email and bio; with both passwords, the password too (which signs out other sessions).</summary>
    [HttpPatch]
    [ProducesResponseType<MessageResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(UpdateProfileRequest request, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(me.Id);
        if (user == null)
            return NotFoundError("User not found.");

        if (!string.IsNullOrEmpty(request.CurrentPassword) && !string.IsNullOrEmpty(request.NewPassword))
        {
            if (!await users.CheckPasswordAsync(user, request.CurrentPassword))
                return BadRequestError("Current password is incorrect.");
            var changed = await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
            if (!changed.Succeeded)
                return BadRequestError(changed.Errors.First().Description);
            await tokens.RevokeAllAsync(user.Id, ct);
        }

        var email = request.Email?.Trim();
        if (!string.IsNullOrEmpty(email) && !string.Equals(email, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            if (await users.FindByEmailAsync(email) != null)
                return ConflictError("Another account already uses this email.");
            user.Email = email;
            user.UserName = email;
        }
        if (!string.IsNullOrWhiteSpace(request.Name))
            user.Name = request.Name.Trim();
        user.Bio = request.Bio;

        var result = await users.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequestError(result.Errors.First().Description);
        return Ok(new MessageResponse("Profile updated successfully"));
    }
}
