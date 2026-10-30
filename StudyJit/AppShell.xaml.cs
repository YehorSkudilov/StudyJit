using StudyJit.Views;
using StudyJit.Views.Study;

namespace StudyJit;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();
        Routing.RegisterRoute(Routes.Course, typeof(CoursePage));
        Routing.RegisterRoute(Routes.NewCourse, typeof(NewCoursePage));
        Routing.RegisterRoute(Routes.Set, typeof(SetPage));
        Routing.RegisterRoute(Routes.NewExam, typeof(NewExamPage));
        Routing.RegisterRoute(Routes.Study, typeof(StudyPage));
        Routing.RegisterRoute(Routes.Account, typeof(AccountPage));
    }
}

public static class Routes
{
    /// <summary>A course's study sets, exams and files (?id=).</summary>
    public const string Course = "course";
    public const string NewCourse = "newcourse";
    /// <summary>A study set or exam and its study modes (?id=).</summary>
    public const string Set = "set";
    /// <summary>A new exam from a course's study sets (?course=).</summary>
    public const string NewExam = "newexam";
    /// <summary>Studying a set in one mode (?id=&amp;mode=, a <see cref="Services.StudyMode"/>).</summary>
    public const string Study = "study";
    public const string Account = "account";
}
