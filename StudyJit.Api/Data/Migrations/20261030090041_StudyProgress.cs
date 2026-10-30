using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyJit.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class StudyProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StudyAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    QuizId = table.Column<int>(type: "integer", nullable: false),
                    Key = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Correct = table.Column<bool>(type: "boolean", nullable: false),
                    AnsweredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudyAnswers_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StudyAnswers_Quizzes_QuizId",
                        column: x => x.QuizId,
                        principalTable: "Quizzes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StudyBests",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Value = table.Column<double>(type: "double precision", nullable: false),
                    LowerIsBetter = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyBests", x => new { x.UserId, x.Key });
                    table.ForeignKey(
                        name: "FK_StudyBests_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudyAnswers_QuizId",
                table: "StudyAnswers",
                column: "QuizId");

            migrationBuilder.CreateIndex(
                name: "IX_StudyAnswers_UserId_QuizId",
                table: "StudyAnswers",
                columns: new[] { "UserId", "QuizId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudyAnswers");

            migrationBuilder.DropTable(
                name: "StudyBests");
        }
    }
}
