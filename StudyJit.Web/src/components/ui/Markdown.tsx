import { Fragment } from "react";

/** Headings (#, ##, ###), bullet lists (- or *), numbered lists and **bold**: what the guide is written in. */
export default function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list = null as { ordered: boolean; items: string[] } | null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length} className="leading-relaxed">{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => (
      <li key={i} className="pl-1">
        {inline(it)}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="list-decimal pl-6 flex flex-col gap-1.5 marker:text-brand marker:font-bold">
          {items}
        </ol>
      ) : (
        <ul key={blocks.length} className="list-disc pl-6 flex flex-col gap-1.5 marker:text-brand">
          {items}
        </ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(
        <h2
          key={blocks.length}
          className={level === 1 ? "text-2xl font-extrabold mt-4" : level === 2 ? "text-xl font-bold mt-6 pb-1 border-b border-stroke" : "text-lg font-bold mt-4"}
        >
          {inline(heading[2])}
        </h2>
      );
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return <div className="flex flex-col gap-3 text-[1.02rem]">{blocks}</div>;
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-bold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
