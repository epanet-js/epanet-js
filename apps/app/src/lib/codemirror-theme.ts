import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const text = "var(--cm-text)",
  comment = "var(--cm-comment)",
  keyword = "var(--cm-keyword)",
  literal = "var(--cm-literal)",
  invalid = "var(--cm-invalid)",
  lineNumber = "var(--highlight-dark-gray)",
  selection = "var(--highlight-light-gray)",
  background = "var(--highlight-background)";

function underline(color: string) {
  if (typeof btoa != "function") return "none";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="6" height="3">
    <path d="m0 3 l2 -2 l1 0 l2 2 l1 0" stroke="${color}" fill="none" stroke-width=".9"/>
  </svg>`;
  return `url('data:image/svg+xml;base64,${btoa(svg)}')`;
}

export const placemarkBaseTheme = EditorView.theme({
  ".cm-lintRange-error": { backgroundImage: underline("#DC2626") },
  "&": {
    height: "16rem",
    color: text,
    backgroundColor: background,
  },

  ".cm-content": {
    caretColor: text,
    fontFamily: "var(--cm-font)",
    padding: "4px",
    fontSize: "12px",
  },
  ".cm-line": {
    padding: "0px",
  },

  "&.cm-focused .cm-cursor": { borderLeftColor: text },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
    {
      backgroundColor: selection,
    },

  ".cm-panels": { backgroundColor: background, color: text },
  ".cm-scroller": { overflow: "auto" },

  ".cm-searchMatch": {
    backgroundColor: "#72a1ff59",
    outline: "1px solid #457dff",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#6199ff2f",
  },

  ".cm-selectionMatch": { backgroundColor: selection },

  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: selection,
  },

  ".cm-gutters": {
    backgroundColor: background,
    color: lineNumber,
    border: "none",
  },

  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: comment,
  },
  ".cm-diagnostic-error": { borderLeft: "initial" },
  ".cm-diagnostic-warning": {
    borderLeft: "initial",
  },
  ".cm-diagnostic-info": { borderLeft: "initial" },

  ".cm-tooltip": {
    color: "var(--highlight-tooltip-text)",
    borderRadius: "2px",
    boxShadow:
      "rgb(255, 255, 255) 0px 0px 0px 0px, rgb(229, 229, 229) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px",
    backgroundColor: background,
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: selection,
      color: text,
    },
  },
});

// Restrained scheme: dark-grey base text, purple for keywords, green for
// literals, grey italics for comments. Everything unlisted inherits the base.
export const placemarkHighlightStyle = HighlightStyle.define([
  {
    tag: [
      t.keyword,
      t.operatorKeyword,
      t.modifier,
      t.self,
      t.atom,
      t.bool,
      t.null,
    ],
    color: keyword,
  },
  {
    tag: [t.string, t.special(t.string), t.regexp, t.escape, t.number],
    color: literal,
  },
  { tag: [t.comment, t.meta], color: comment, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: comment, textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold" },
  { tag: t.invalid, color: invalid },
]);

export const placemarkTheme: Extension = [
  placemarkBaseTheme,
  syntaxHighlighting(placemarkHighlightStyle),
];
