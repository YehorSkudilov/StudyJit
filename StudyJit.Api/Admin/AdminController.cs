using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyJit.Api.Auth;
using StudyJit.Api.Controllers;
using StudyJit.Api.Data;
using StudyJit.Api.Files;
using StudyJit.Api.Quizzes;

namespace StudyJit.Api.Admin;

public record DayCount(string Date, int Count);

public record AdminUserRow(
    string Id,
    string Email,
    string Name,
    DateTimeOffset CreatedAt,
    string? Role,
    string Status,
    int Quizzes,
    int Files,
    long StorageBytes);

public record DashboardResponse(
    int TotalUsers,
    int NewUsers7d,
    int NewUsers30d,
    int DisabledUsers,
    int Admins,
    int QuizzesTotal,
    int QuizzesGenerated,
    int QuestionsTotal,
    int FilesTotal,
    long StorageBytes,
    int Queued,
    int Generating,
    int Failed,
    List<DayCount> SignupsByDay,
    List<DayCount> QuizzesByDay,
    List<AdminUserRow> RecentUsers);

public record AdminQuizRow(
    int Id,
    string Name,
    string UserId,
    string UserEmail,
    string Status,
    int? QueueNumber,
    int NumQuestions,
    int Questions,
    decimal? LastScore,
    int Files,
    DateTimeOffset CreatedAt);

public record AdminFileRow(int Id, string Name, long Size, string? MimeType, DateTimeOffset UploadedAt);

public record AdminUserDetail(AdminUserRow User, string? Bio, int ActiveSessions, List<AdminQuizRow> Quizzes, List<AdminFileRow> Files);

public record GenerationResponse(bool OpenAiConfigured, List<AdminQuizRow> Running, List<AdminQuizRow> Queued, List<AdminQuizRow> RecentFailed);

public record SetDisabledRequest(bool Disabled);

public record SetRoleRequest(string? Role);

public record CreateUserRequest(string? Email, string? Name, string? Password, string? Role);

/// <summary>The admin site's endpoints (StudyJit.AdminWeb). Admins and SuperAdmins only; some actions SuperAdmins only.</summary>
[Route("api/admin")]
[Authorize(Policy = AuthPolicies.AdminAccess)]
public class AdminController(ApiDbContext db, Microsoft.AspNetCore.Identity.UserManager<AppUser> userManager, ICurrentUser me, TokenService tokens, FileStorage storage, QuizGenerationQueue queue,
    OpenAiQuizClient openAi, TimeProvider clock) : ApiControllerBase
{
    [HttpGet("dashboard")]
    [ProducesResponseType<DashboardResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var since30 = now.AddDays(-30);
        var since7 = now.AddDays(-7);
        var signups = await db.Users.Where(u => u.CreatedAt >= since30).Select(u => u.CreatedAt).ToListAsync(ct);
        var quizDates = await db.Quizzes.Where(q => q.CreatedAt >= since30).Select(q => q.CreatedAt).ToListAsync(ct);

        return Ok(new DashboardResponse(
            TotalUsers: await db.Users.CountAsync(ct),
            NewUsers7d: signups.Count(d => d >= since7),
            NewUsers30d: signups.Count,
            DisabledUsers: await db.Users.CountAsync(u => u.LockoutEnd != null && u.LockoutEnd.Value.Year >= 9999, ct),
            Admins: await db.Users.CountAsync(u => u.AdminRole != null, ct),
            QuizzesTotal: await db.Quizzes.CountAsync(ct),
            QuizzesGenerated: await db.Quizzes.CountAsync(q => q.GenerationStatus == GenerationStatus.Success, ct),
            QuestionsTotal: await db.QuizQuestions.CountAsync(ct),
            FilesTotal: await db.Files.CountAsync(ct),
            StorageBytes: await db.Files.SumAsync(f => (long?)f.Size, ct) ?? 0,
            Queued: await db.Quizzes.CountAsync(q => q.GenerationStatus == GenerationStatus.Queued, ct),
            Generating: await db.Quizzes.CountAsync(q => q.GenerationStatus == GenerationStatus.Pending, ct),
            Failed: await db.Quizzes.CountAsync(q => q.GenerationStatus == GenerationStatus.Failed, ct),
            SignupsByDay: ByDay(signups, now),
            QuizzesByDay: ByDay(quizDates, now),
            RecentUsers: await UserRows(db.Users.OrderByDescending(u => u.CreatedAt).Take(8), ct)));
    }

    /// <summary>Up to 300 accounts, newest first. q searches email and name; filter is new, admins or disabled.</summary>
    [HttpGet("users")]
    [ProducesResponseType<List<AdminUserRow>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Users(string? q, string? filter, CancellationToken ct)
    {
        var users = db.Users.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = $"%{q.Trim()}%";
            users = users.Where(u => EF.Functions.ILike(u.Email!, pattern) || EF.Functions.ILike(u.Name, pattern));
        }
        var since7 = clock.GetUtcNow().AddDays(-7);
        users = filter switch
        {
            "new" => users.Where(u => u.CreatedAt >= since7),
            "admins" => users.Where(u => u.AdminRole != null),
            "disabled" => users.Where(u => u.LockoutEnd != null && u.LockoutEnd.Value.Year >= 9999),
            _ => users,
        };
        return Ok(await UserRows(users.OrderByDescending(u => u.CreatedAt).Take(300), ct));
    }

    [HttpGet("users/{id}")]
    [ProducesResponseType<AdminUserDetail>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UserDetail(string id, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user == null)
            return NotFoundError("User not found.");
        var now = clock.GetUtcNow();
        var row = (await UserRows(db.Users.Where(u => u.Id == id), ct)).Single();
        return Ok(new AdminUserDetail(
            row,
            user.Bio,
            await db.RefreshTokens.CountAsync(t => t.UserId == id && t.RevokedAt == null && t.ExpiresAt > now, ct),
            await QuizRows(db.Quizzes.Where(q => q.UserId == id).OrderByDescending(q => q.Id).Take(200), ct),
            await db.Files.Where(f => f.UserId == id).OrderByDescending(f => f.UploadedAt).Take(200)
                .Select(f => new AdminFileRow(f.Id, f.Name, f.Size, f.MimeType, f.UploadedAt)).ToListAsync(ct)));
    }

    /// <summary>
    /// Creates an account with the password given (the admin passes it on), e.g. while sign-up is off. Only a SuperAdmin
    /// can give it an admin role.
    /// </summary>
    [HttpPost("users")]
    [ProducesResponseType<AdminUserRow>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateUser(CreateUserRequest request, CancellationToken ct)
    {
        var email = request.Email?.Trim() ?? "";
        var name = request.Name?.Trim() ?? "";
        if (email.Length == 0 || name.Length == 0 || string.IsNullOrEmpty(request.Password))
            return BadRequestError("Email, name, and password are required.");
        if (request.Role != null && !AdminRoles.IsValid(request.Role))
            return BadRequestError("Unknown role.");
        if (request.Role != null && !IsSuperAdmin)
            return Error(StatusCodes.Status403Forbidden, "Only a SuperAdmin can give an account an admin role.");
        if (await userManager.FindByEmailAsync(email) != null)
            return ConflictError("An account with this email already exists.");

        var user = new AppUser { UserName = email, Email = email, Name = name, AdminRole = request.Role, CreatedAt = clock.GetUtcNow() };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return BadRequestError(result.Errors.First().Description);
        return Ok((await UserRows(db.Users.Where(u => u.Id == user.Id), ct)).Single());
    }

    /// <summary>Disables (locks out for good and signs out everywhere) or re-enables an account.</summary>
    [HttpPost("users/{id}/disabled")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetDisabled(string id, SetDisabledRequest request, CancellationToken ct)
    {
        if (id == me.Id)
            return BadRequestError("You can't disable your own account.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user == null)
            return NotFoundError("User not found.");
        if (user.AdminRole == AdminRoles.SuperAdmin && !IsSuperAdmin)
            return Error(StatusCodes.Status403Forbidden, "Only a SuperAdmin can disable a SuperAdmin.");

        user.LockoutEnd = request.Disabled ? AccountStatus.DisabledUntil : null;
        user.AccessFailedCount = 0;
        await db.SaveChangesAsync(ct);
        if (request.Disabled)
            await tokens.RevokeAllAsync(id, ct);
        return Ok(Success());
    }

    [HttpPost("users/{id}/sign-out")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SignOutEverywhere(string id, CancellationToken ct)
    {
        await tokens.RevokeAllAsync(id, ct);
        return Ok(Success());
    }

    /// <summary>Admin, SuperAdmin, or null for a regular user.</summary>
    [HttpPost("users/{id}/role")]
    [Authorize(Policy = AuthPolicies.SuperAdminOnly)]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetRole(string id, SetRoleRequest request, CancellationToken ct)
    {
        if (request.Role != null && !AdminRoles.IsValid(request.Role))
            return BadRequestError("Unknown role.");
        if (id == me.Id)
            return BadRequestError("You can't change your own role.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user == null)
            return NotFoundError("User not found.");
        user.AdminRole = request.Role;
        await db.SaveChangesAsync(ct);
        return Ok(Success());
    }

    /// <summary>Deletes the account, everything it owns and its files on disk.</summary>
    [HttpDelete("users/{id}")]
    [Authorize(Policy = AuthPolicies.SuperAdminOnly)]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteUser(string id, CancellationToken ct)
    {
        if (id == me.Id)
            return BadRequestError("You can't delete your own account here.");
        var deleted = await db.Users.Where(u => u.Id == id).ExecuteDeleteAsync(ct);
        if (deleted == 0)
            return NotFoundError("User not found.");
        storage.DeleteUserFolder(id);
        return Ok(Success());
    }

    /// <summary>What the generator is doing: the running quiz, the queue in order, and the latest failures.</summary>
    [HttpGet("generation")]
    [ProducesResponseType<GenerationResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Generation(CancellationToken ct)
    {
        var (running, waiting) = queue.Snapshot();
        var listed = waiting.Append(running ?? 0).ToArray();
        var rows = await QuizRows(db.Quizzes.Where(q => listed.Contains(q.Id)), ct);
        var failed = await QuizRows(db.Quizzes.Where(q => q.GenerationStatus == GenerationStatus.Failed).OrderByDescending(q => q.Id).Take(30), ct);
        return Ok(new GenerationResponse(
            openAi.IsConfigured,
            rows.Where(r => r.Id == running).ToList(),
            waiting.Select(id => rows.FirstOrDefault(r => r.Id == id)).OfType<AdminQuizRow>().ToList(),
            failed));
    }

    /// <summary>Queues a quiz for generation again, e.g. after it failed.</summary>
    [HttpPost("quizzes/{id:int}/retry")]
    [ProducesResponseType<SuccessResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Retry(int id, CancellationToken ct)
    {
        var updated = await db.Quizzes.Where(q => q.Id == id && q.GenerationStatus != GenerationStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(q => q.GenerationStatus, GenerationStatus.Queued), ct);
        if (updated == 0)
            return NotFoundError("Quiz not found, or it's generating right now.");
        await queue.EnqueueAsync(id, ct);
        return Ok(Success());
    }

    bool IsSuperAdmin => User.IsInRole(AdminRoles.SuperAdmin);

    async Task<List<AdminUserRow>> UserRows(IQueryable<AppUser> users, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var rows = await users.Select(u => new
        {
            User = u,
            Quizzes = db.Quizzes.Count(q => q.UserId == u.Id),
            Files = db.Files.Count(f => f.UserId == u.Id),
            Storage = db.Files.Where(f => f.UserId == u.Id).Sum(f => (long?)f.Size) ?? 0,
        }).ToListAsync(ct);
        return rows.Select(r => new AdminUserRow(r.User.Id, r.User.Email ?? "", r.User.Name, r.User.CreatedAt, r.User.AdminRole,
            AccountStatus.Of(r.User, now), r.Quizzes, r.Files, r.Storage)).ToList();
    }

    Task<List<AdminQuizRow>> QuizRows(IQueryable<Quiz> quizzes, CancellationToken ct) =>
        quizzes.Join(db.Users, q => q.UserId, u => u.Id, (q, u) => new AdminQuizRow(
            q.Id, q.Name, u.Id, u.Email ?? "", q.GenerationStatus, q.QueueNumber, q.NumQuestions,
            db.QuizQuestions.Count(x => x.QuizId == q.Id), q.LastScore, db.QuizFiles.Count(l => l.QuizId == q.Id), q.CreatedAt))
        .ToListAsync(ct);

    static List<DayCount> ByDay(List<DateTimeOffset> dates, DateTimeOffset now)
    {
        var counts = dates.GroupBy(d => d.UtcDateTime.Date).ToDictionary(g => g.Key, g => g.Count());
        return Enumerable.Range(0, 30).Select(i => now.UtcDateTime.Date.AddDays(i - 29))
            .Select(day => new DayCount(day.ToString("yyyy-MM-dd"), counts.GetValueOrDefault(day))).ToList();
    }
}
