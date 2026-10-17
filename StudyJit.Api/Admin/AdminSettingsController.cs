using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyJit.Api.Auth;
using StudyJit.Api.Controllers;

namespace StudyJit.Api.Admin;

public record AdminSettings(bool SignUpEnabled);

/// <summary>Settings that apply to everyone (see <see cref="ServerSettings"/>): every admin sees them, a SuperAdmin changes them.</summary>
[Route("api/admin/settings")]
[Authorize(Policy = AuthPolicies.AdminAccess)]
public class AdminSettingsController(ServerSettings settings, ILogger<AdminSettingsController> log) : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType<AdminSettings>(StatusCodes.Status200OK)]
    public async Task<AdminSettings> Get(CancellationToken ct) => new(await settings.SignUpEnabledAsync(ct));

    [HttpPut]
    [Authorize(Policy = AuthPolicies.SuperAdminOnly)]
    [ProducesResponseType<AdminSettings>(StatusCodes.Status200OK)]
    public async Task<AdminSettings> Set(AdminSettings request, CancellationToken ct)
    {
        await settings.SetSignUpEnabledAsync(request.SignUpEnabled, ct);
        log.LogInformation("Admin {Admin} set sign-up enabled to {Enabled}", User.FindFirst("sub")?.Value, request.SignUpEnabled);
        return await Get(ct);
    }
}
