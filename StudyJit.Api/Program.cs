using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StudyJit.Api;
using StudyJit.Api.Admin;
using StudyJit.Api.Auth;
using StudyJit.Api.Data;
using StudyJit.Api.Files;
using StudyJit.Api.Quizzes;
using StudyJit.Api.Swagger;

// Settings from .env next to the project, the same file docker-compose uses (see .env.example). Must run before the
// builder reads environment variables.
DotEnv.Load(Path.Combine(Directory.GetCurrentDirectory(), ".env"));

var builder = WebApplication.CreateBuilder(args);

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
jwt.Validate();
builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton(TimeProvider.System);

// Nothing legitimate is large except file chunks, whose endpoint raises its own limit.
builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = 1024 * 1024);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddDbContext<ApiDbContext>(o => o.UseNpgsql(
    builder.Configuration.GetConnectionString("Default") ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.")));

builder.Services.AddIdentityCore<AppUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        // The user name is the email, so allow every character an email can contain.
        o.User.AllowedUserNameCharacters = "";
        // Length over composition rules (NIST SP 800-63B); lockout and rate limits handle guessing.
        o.Password.RequiredLength = AuthPolicies.MinPasswordLength;
        o.Password.RequireDigit = false;
        o.Password.RequireLowercase = false;
        o.Password.RequireUppercase = false;
        o.Password.RequireNonAlphanumeric = false;
        o.Lockout.AllowedForNewUsers = true;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddSignInManager()
    .AddEntityFrameworkStores<ApiDbContext>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = jwt.Key,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "sub",
            RoleClaimType = AuthPolicies.RoleClaim,
        };
    });

// Every endpoint requires a signed-in user unless it opts out with [AllowAnonymous].
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    // The admin site (see Admin/AdminRoles.cs).
    .AddPolicy(AuthPolicies.AdminAccess, p => p.RequireAuthenticatedUser().RequireRole(AdminRoles.Admin, AdminRoles.SuperAdmin))
    .AddPolicy(AuthPolicies.SuperAdminOnly, p => p.RequireAuthenticatedUser().RequireRole(AdminRoles.SuperAdmin));

var authPerMinute = builder.Configuration.GetValue("RateLimiting:AuthPerMinute", 10);
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(RateLimits.Auth, ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = authPerMinute, Window = TimeSpan.FromMinutes(1) }));
    // Each generation is a paid OpenAI call.
    o.AddPolicy(RateLimits.Generate, ctx => RateLimitPartition.GetTokenBucketLimiter(
        ctx.User.FindFirst("sub")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new TokenBucketRateLimiterOptions { TokenLimit = 10, TokensPerPeriod = 10, ReplenishmentPeriod = TimeSpan.FromHours(1) }));
});

builder.Services.AddScoped<TokenService>();
// Settings admins change while the server runs (whether anyone may sign up).
builder.Services.AddScoped<ServerSettings>();

// Uploaded files on disk (see Files/).
builder.Services.AddSingleton(builder.Configuration.GetSection("Storage").Get<StorageOptions>() ?? new StorageOptions());
builder.Services.AddSingleton<FileStorage>();
builder.Services.AddSingleton<YouTubeDownloader>();

// Quiz generation with OpenAI, one quiz at a time (see Quizzes/).
var openAi = builder.Configuration.GetSection("OpenAI").Get<OpenAiOptions>() ?? new OpenAiOptions();
builder.Services.AddSingleton(openAi);
builder.Services.AddHttpClient<OpenAiQuizClient>(c => c.Timeout = TimeSpan.FromSeconds(openAi.TimeoutSeconds));
builder.Services.AddScoped<QuizGenerator>();
builder.Services.AddSingleton<QuizGenerationQueue>();
builder.Services.AddHostedService<QuizGenerationWorker>();

// The website (StudyJit.Web) and the admin site (StudyJit.AdminWeb) call the API from their own addresses: their
// origins, from Cors__AllowedOrigins (comma-separated). Bearer tokens, no cookies, so no credentials. Unset: no browser
// origin may call it.
var corsOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(o => o.TrimEnd('/')).ToArray();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddProblemDetails();
builder.Services.AddControllers(o =>
    {
        // Otherwise every non-nullable string becomes [Required], which rejects legitimately empty values.
        o.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
        o.MaxModelValidationErrors = 50;
    })
    .AddJsonOptions(o =>
    {
        // The web app sends ids as strings ("12"), and "root" or "" for the top folder.
        o.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString;
        o.JsonSerializerOptions.Converters.Add(new LenientNullableIntConverter());
    });
builder.Services.AddSwagger(builder.Configuration);

var app = builder.Build();

// Only trusts X-Forwarded-* from loopback, plus any networks in ReverseProxy:KnownNetworks (comma-separated
// CIDRs) - otherwise behind a proxy, client IPs (used for rate limiting) would all be the proxy's.
var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto };
foreach (var network in (app.Configuration["ReverseProxy:KnownNetworks"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    forwarded.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
app.UseForwardedHeaders(forwarded);

// Single-instance deployments apply pending migrations at startup (docker-compose.yml turns this on).
if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<ApiDbContext>().Database.Migrate();
}

// The first SuperAdmin(s), from Admin__BootstrapEmails.
using (var scope = app.Services.CreateScope())
    await AdminBootstrapper.RunAsync(scope.ServiceProvider, app.Configuration);

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseSwaggerWithAuth();
app.UseCors();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok()).AllowAnonymous();

app.Run();

namespace StudyJit.Api
{
    public static class RateLimits
    {
        public const string Auth = "auth";
        public const string Generate = "generate";
    }

    /// <summary>Reads an int? from a number, a numeric string, or null; any other string ("root", "") reads as null.</summary>
    public class LenientNullableIntConverter : JsonConverter<int?>
    {
        public override int? Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options) =>
            reader.TokenType switch
            {
                System.Text.Json.JsonTokenType.Number => reader.GetInt32(),
                System.Text.Json.JsonTokenType.String => int.TryParse(reader.GetString(), out var value) ? value : null,
                System.Text.Json.JsonTokenType.Null => null,
                _ => throw new System.Text.Json.JsonException("Expected a number."),
            };

        public override void Write(System.Text.Json.Utf8JsonWriter writer, int? value, System.Text.Json.JsonSerializerOptions options)
        {
            if (value is { } v)
                writer.WriteNumberValue(v);
            else
                writer.WriteNullValue();
        }
    }
}
