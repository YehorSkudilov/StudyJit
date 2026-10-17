using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace StudyJit.Api.Data;

public class ApiDbContext(DbContextOptions<ApiDbContext> options) : IdentityDbContext<AppUser>(options)
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Folder> Folders => Set<Folder>();
    public DbSet<StoredFile> Files => Set<StoredFile>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<QuizFile> QuizFiles => Set<QuizFile>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<AppUser>(e =>
        {
            e.Property(u => u.Name).HasMaxLength(255);
            e.Property(u => u.AdminRole).HasMaxLength(20);
        });

        b.Entity<RefreshToken>(e =>
        {
            e.Property(t => t.TokenHash).HasMaxLength(64);
            e.HasIndex(t => t.TokenHash).IsUnique();
            e.HasIndex(t => t.FamilyId);
            e.HasIndex(t => t.UserId);
            e.HasOne<AppUser>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // Deleting an account deletes everything it owns. Folder contents are deleted by the API (see FoldersController),
        // so the folder keys on quizzes and files only clear as a fallback.
        b.Entity<Folder>(e =>
        {
            e.Property(f => f.Name).HasMaxLength(255);
            e.Property(f => f.Context).HasMaxLength(16);
            e.HasIndex(f => new { f.UserId, f.Context, f.ParentId });
            e.HasOne<AppUser>().WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Folder>().WithMany().HasForeignKey(f => f.ParentId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<StoredFile>(e =>
        {
            e.ToTable("StoredFiles");
            e.Property(f => f.Name).HasMaxLength(255);
            e.Property(f => f.MimeType).HasMaxLength(255);
            e.HasIndex(f => new { f.UserId, f.FolderId });
            e.HasOne<AppUser>().WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Folder>().WithMany().HasForeignKey(f => f.FolderId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Quiz>(e =>
        {
            e.Property(q => q.Name).HasMaxLength(255);
            e.Property(q => q.GenerationStatus).HasMaxLength(20);
            e.Property(q => q.LastScore).HasPrecision(5, 2);
            e.HasIndex(q => new { q.UserId, q.FolderId });
            e.HasIndex(q => q.GenerationStatus);
            e.HasOne<AppUser>().WithMany().HasForeignKey(q => q.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Folder>().WithMany().HasForeignKey(q => q.FolderId).OnDelete(DeleteBehavior.SetNull);
            e.HasMany(q => q.Questions).WithOne().HasForeignKey(q => q.QuizId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<QuizFile>(e =>
        {
            e.HasIndex(l => new { l.QuizId, l.FileId }).IsUnique();
            e.HasOne<Quiz>().WithMany().HasForeignKey(l => l.QuizId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<StoredFile>().WithMany().HasForeignKey(l => l.FileId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
