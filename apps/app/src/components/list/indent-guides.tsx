import clsx from "clsx";
import type { CSSProperties } from "react";

export const SECTION_INDENT_STYLE = {
  "--list-indent": "1rem",
} as CSSProperties;

export const rowIndent = (depth = 0, extra?: string) =>
  `calc(var(--list-indent, 0px) + ${depth}rem${extra ? ` + ${extra}` : ""})`;

export const indentGuideClass = (isActive: boolean) =>
  clsx(
    "pointer-events-none absolute top-0 bottom-0 border-l",
    isActive ? "border-gray-400 dark:border-gray-500" : "border-base",
  );

const CHEVRON_CENTER_REM = 0.875;

export const IndentGuides = ({
  depth,
  activeLevel,
}: {
  depth: number;
  activeLevel?: number;
}) => (
  <>
    {Array.from({ length: depth }, (_, level) => (
      <span
        key={level}
        aria-hidden
        className={indentGuideClass(level === activeLevel)}
        style={{
          left: `calc(var(--list-indent, 0px) + ${level + CHEVRON_CENTER_REM}rem)`,
        }}
      />
    ))}
  </>
);
