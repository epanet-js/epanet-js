import clsx from "clsx";

export type IndentGuide = "full" | "end" | "none";

const CHEVRON_CENTER_REM = 0.875;

export const childGuides = (
  parentGuides: readonly IndentGuide[],
  isLast: boolean,
): IndentGuide[] => [
  ...parentGuides.map(
    (guide): IndentGuide => (guide === "end" ? "none" : guide),
  ),
  isLast ? "end" : "full",
];

export const IndentGuides = ({
  guides,
}: {
  guides: readonly IndentGuide[];
}) => (
  <>
    {guides.map((guide, level) =>
      guide === "none" ? null : (
        <span
          key={level}
          aria-hidden
          className={clsx(
            "pointer-events-none absolute top-0 border-l border-base",
            guide === "end" ? "h-1/2" : "bottom-0",
          )}
          style={{ left: `${level + CHEVRON_CENTER_REM}rem` }}
        />
      ),
    )}
  </>
);
