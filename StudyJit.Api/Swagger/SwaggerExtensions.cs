using Microsoft.Extensions.Options;
using Microsoft.OpenApi;

namespace StudyJit.Api.Swagger;

public static class SwaggerExtensions
{
    public static IServiceCollection AddSwagger(this IServiceCollection services, IConfiguration config)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(o =>
        {
            o.AddSecurityDefinition("bearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "JWT Authorization header using the Bearer scheme.",
            });
            o.OperationFilter<AuthorizeOperationFilter>();
        });

        services.AddOptions<SwaggerAuthOptions>().Bind(config.GetSection("SwaggerAuth")).ValidateOnStart();
        services.AddSingleton<IValidateOptions<SwaggerAuthOptions>, ValidateSwaggerAuthOptions>();
        return services;
    }

    // Must run before authentication/authorization: /swagger has no endpoint, so the fallback policy would reject it.
    public static WebApplication UseSwaggerWithAuth(this WebApplication app)
    {
        app.UseMiddleware<SwaggerAuthMiddleware>();
        app.UseSwagger();
        app.UseSwaggerUI();
        return app;
    }
}
