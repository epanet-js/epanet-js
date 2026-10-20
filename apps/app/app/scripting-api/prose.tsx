import type { ReactNode } from "react";
import { CodeBlock } from "./code-block";

export type Anchors = ReadonlyMap<string, string>;

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;

const anchorFor = (code: string, anchors: Anchors): string | null => {
  const segments = (/^[A-Za-z][\w.]*/.exec(code)?.[0] ?? "")
    .split(".")
    .filter(Boolean);
  for (let length = segments.length; length > 0; length--) {
    const anchor = anchors.get(segments.slice(0, length).join("."));
    if (anchor) return anchor;
  }
  return null;
};

const InlineCode = ({ code, anchors }: { code: string; anchors: Anchors }) => {
  const element = (
    <code className="rounded bg-panel px-1 py-0.5 font-mono text-[0.9em]">
      {code}
    </code>
  );
  const anchor = anchorFor(code, anchors);
  return anchor ? (
    <a
      href={`#${anchor}`}
      className="text-accent underline decoration-dotted underline-offset-2"
    >
      {element}
    </a>
  ) : (
    element
  );
};

export const inline = (text: string, anchors: Anchors): ReactNode[] =>
  text.split(INLINE).map((part, index) => {
    if (index % 2 === 0) return part;
    if (part.startsWith("`")) {
      return (
        <InlineCode key={index} code={part.slice(1, -1)} anchors={anchors} />
      );
    }
    if (part.startsWith("**")) {
      return (
        <strong key={index} className="font-semibold">
          {inline(part.slice(2, -2), anchors)}
        </strong>
      );
    }
    return <em key={index}>{inline(part.slice(1, -1), anchors)}</em>;
  });

type Block =
  | { kind: "code"; language: "js" | "ts"; code: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

const LIST_ITEM = /^\s*-\s+(.*)$/;

const parseBlocks = (markdown: string): Block[] => {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  const paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph.length = 0;
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushParagraph();
      const language = line.slice(3).trim() === "ts" ? "ts" : "js";
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "code", language, code: code.join("\n") });
      i++;
      continue;
    }
    if (LIST_ITEM.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        const item = LIST_ITEM.exec(lines[i]);
        if (item) items.push(item[1]);
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    if (line.trim() === "") flushParagraph();
    else paragraph.push(line.trim());
    i++;
  }
  flushParagraph();
  return blocks;
};

export const Prose = ({
  markdown,
  anchors,
}: {
  markdown: string;
  anchors: Anchors;
}) => (
  <div className="text-size-base leading-relaxed text-default">
    {parseBlocks(markdown).map((block, index) => {
      switch (block.kind) {
        case "code":
          return (
            <CodeBlock
              key={index}
              code={block.code}
              language={block.language}
            />
          );
        case "list":
          return (
            <ul key={index} className="my-2 list-disc space-y-1 pl-6">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item, anchors)}</li>
              ))}
            </ul>
          );
        case "paragraph":
          return (
            <p key={index} className="my-2">
              {inline(block.text, anchors)}
            </p>
          );
      }
    })}
  </div>
);
