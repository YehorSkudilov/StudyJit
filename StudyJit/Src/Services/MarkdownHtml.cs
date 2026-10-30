using Markdig;

namespace StudyJit.Services;

/// <summary>
/// The study guide and cheat sheet (Markdown, with code blocks and tables) as a page for a WebView, in the app's colours.
/// </summary>
public static class MarkdownHtml
{
    static readonly MarkdownPipeline Pipeline = new MarkdownPipelineBuilder().UseAdvancedExtensions().DisableHtml().Build();

    public static string Page(string markdown) => $$"""
        <!DOCTYPE html>
        <html><head>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          html { background: #0A0F1C; color: #E8EDF6; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 16px; }
          body { margin: 0; padding: 4px 16px 32px; line-height: 1.55; overflow-wrap: anywhere; }
          h1, h2, h3, h4 { line-height: 1.25; margin: 1.3em 0 .5em; }
          h1 { font-size: 1.45em; } h2 { font-size: 1.25em; color: #4C95F5; } h3 { font-size: 1.08em; }
          a { color: #2FD4E6; }
          code { font-family: ui-monospace, "Cascadia Code", Menlo, monospace; font-size: .88em; background: #1A2438; padding: .1em .35em; border-radius: 5px; }
          pre { background: #121A2B; border: 1px solid #233049; border-radius: 12px; padding: 12px; white-space: pre-wrap; }
          pre code { background: none; padding: 0; }
          table { border-collapse: collapse; width: 100%; font-size: .92em; margin: .8em 0; }
          th, td { border: 1px solid #233049; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { background: #1A2438; }
          blockquote { margin: .8em 0; padding: .2em 1em; border-left: 3px solid #4C95F5; color: #8B98B0; }
          hr { border: none; border-top: 1px solid #233049; margin: 1.5em 0; }
          dt { font-weight: 600; margin-top: .8em; } dd { margin: .2em 0 0; color: #C5CEDD; }
        </style></head>
        <body>{{Markdown.ToHtml(markdown, Pipeline)}}</body></html>
        """;
}
