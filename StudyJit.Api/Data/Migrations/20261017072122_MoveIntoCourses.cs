using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyJit.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MoveIntoCourses : Migration
    {
        /// <inheritdoc />
        /// <remarks>
        /// Everything now lives in a course: each user's study sets and files that aren't in one move into a "General"
        /// course, made for them if they have none.
        /// </remarks>
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO "Courses" ("UserId", "Code", "Name", "Term", "Color", "CreatedAt")
                SELECT owners."UserId", '', 'General', '', 'blue', now()
                FROM (
                    SELECT "UserId" FROM "Quizzes" WHERE "CourseId" IS NULL
                    UNION
                    SELECT "UserId" FROM "StoredFiles" WHERE "CourseId" IS NULL
                ) AS owners
                WHERE NOT EXISTS (
                    SELECT 1 FROM "Courses" c WHERE c."UserId" = owners."UserId" AND c."Code" = '' AND c."Name" = 'General'
                );

                UPDATE "Quizzes" AS q SET "CourseId" = (
                    SELECT MIN(c."Id") FROM "Courses" c WHERE c."UserId" = q."UserId" AND c."Code" = '' AND c."Name" = 'General'
                )
                WHERE q."CourseId" IS NULL;

                UPDATE "StoredFiles" AS f SET "CourseId" = (
                    SELECT MIN(c."Id") FROM "Courses" c WHERE c."UserId" = f."UserId" AND c."Code" = '' AND c."Name" = 'General'
                )
                WHERE f."CourseId" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Items stay in their courses; there's nothing to undo.
        }
    }
}
