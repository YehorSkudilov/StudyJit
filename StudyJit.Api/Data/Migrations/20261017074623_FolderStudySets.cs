using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace StudyJit.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class FolderStudySets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CheatSheets");

            migrationBuilder.AddColumn<string>(
                name: "CheatSheet",
                table: "Quizzes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "Quizzes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "set");

            migrationBuilder.AddColumn<List<int>>(
                name: "SourceQuizIds",
                table: "Quizzes",
                type: "integer[]",
                nullable: false,
                defaultValueSql: "'{}'");

            migrationBuilder.AddColumn<int>(
                name: "CourseId",
                table: "Folders",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Folders_CourseId",
                table: "Folders",
                column: "CourseId");

            migrationBuilder.AddForeignKey(
                name: "FK_Folders_Courses_CourseId",
                table: "Folders",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Folders_Courses_CourseId",
                table: "Folders");

            migrationBuilder.DropIndex(
                name: "IX_Folders_CourseId",
                table: "Folders");

            migrationBuilder.DropColumn(
                name: "CheatSheet",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "SourceQuizIds",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "CourseId",
                table: "Folders");

            migrationBuilder.CreateTable(
                name: "CheatSheets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Content = table.Column<string>(type: "text", nullable: false),
                    CourseId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Focus = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CheatSheets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CheatSheets_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CheatSheets_CourseId",
                table: "CheatSheets",
                column: "CourseId");
        }
    }
}
