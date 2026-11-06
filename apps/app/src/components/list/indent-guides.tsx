import clsx from "clsx";

export type IndentGuide = "full" | "end";

const CHEVRON_CENTER_REM = 0.875;

export const rowGuides = (
  trailing: readonly boolean[],
  isLeaf: boolean,
): IndentGuide[] => {
  const guides: IndentGuide[] = [];
  let ends = isLeaf;
  for (let level = trailing.length - 1; level >= 0; level--) {
    ends = ends && trailing[level];
    guides[level] = ends ? "end" : "full";
  }
  return guides;
};

export const IndentGuides = ({
  guides,
}: {
  guides: readonly IndentGuide[];
}) => (
  <>
    {guides.map((guide, level) => (
      <span
        key={level}
        aria-hidden
        className={clsx(
          "pointer-events-none absolute top-0 border-l border-base",
          guide === "end" ? "h-1/2" : "bottom-0",
        )}
        style={{ left: `${level + CHEVRON_CENTER_REM}rem` }}
      />
    ))}
  </>
);
