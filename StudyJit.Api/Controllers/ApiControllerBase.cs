using Microsoft.AspNetCore.Mvc;

namespace StudyJit.Api.Controllers;

/// <summary>A refused request's body: { "error": "..." }, a message safe to show.</summary>
public record ErrorResponse(string Error);

/// <summary>Success with nothing else to say: { "success": true }.</summary>
public record SuccessResponse(bool Success = true);

[ApiController]
[Produces("application/json")]
[ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
public abstract class ApiControllerBase : ControllerBase
{
    protected ObjectResult Error(int status, string message) => StatusCode(status, new ErrorResponse(message));
    protected ObjectResult BadRequestError(string message) => Error(StatusCodes.Status400BadRequest, message);
    protected ObjectResult NotFoundError(string message) => Error(StatusCodes.Status404NotFound, message);
    protected ObjectResult ConflictError(string message) => Error(StatusCodes.Status409Conflict, message);
    protected static SuccessResponse Success() => new();
}
