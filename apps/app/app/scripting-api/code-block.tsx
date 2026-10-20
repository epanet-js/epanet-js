import { javascriptLanguage } from "@codemirror/lang-javascript";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import type { ReactNode } from "react";

const COLOR_BY_CLASS: [string, string][] = [
  ["tok-comment", "var(--cm-comment)"],
  ["tok-keyword", "var(--cm-keyword)"],
  ["tok-string", "var(--cm-literal)"],
  ["tok-number", "var(--cm-literal)"],
  ["tok-bool", "var(--cm-literal)"],
  ["tok-null", "var(--cm-literal)"],
  ["tok-typeName", "var(--cm-keyword)"],
  ["tok-className", "var(--cm-keyword)"],
];

const colorFor = (classes: string): string | undefined =>
  COLOR_BY_CLASS.find(([token]) => classes.includes(token))?.[1];

const highlight = (code: string, language: "js" | "ts"): ReactNode[] => {
  const parser =
    language === "ts"
      ? javascriptLanguage.configure({ dialect: "ts" }).parser
      : javascriptLanguage.parser;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  highlightTree(parser.parse(code), classHighlighter, (from, to, classes) => {
    if (from > cursor) nodes.push(code.slice(cursor, from));
    const color = colorFor(classes);
    nodes.push(
      color ? (
        <span key={from} style={{ color }}>
          {code.slice(from, to)}
        </span>
      ) : (
        code.slice(from, to)
      ),
    );
    cursor = to;
  });
  if (cursor < code.length) nodes.push(code.slice(cursor));
  return nodes;
};

export const CodeBlock = ({
  code,
  language = "js",
}: {
  code: string;
  language?: "js" | "ts";
}) => (
  <pre className="my-3 overflow-x-auto rounded border bg-panel p-3 font-mono text-size-small leading-relaxed text-default">
    <code>{highlight(code, language)}</code>
  </pre>
);
