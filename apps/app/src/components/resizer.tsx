import { memo, useEffect, useRef } from "react";
import { Tooltip } from "@epanet-js/ui-kit";
import { useSetAtom, useAtom } from "jotai";
import {
  Side,
  splitsAtom,
  Splits,
  MAX_SPLIT,
  MIN_SPLITS,
  OTHER_SIDE,
} from "src/state/layout";
import { useMove } from "@react-aria/interactions";
import clsx from "clsx";
import { useMediaQuery } from "react-responsive";
import { ChevronLeftIcon, ChevronRightIcon } from "src/icons";

const MIN_MAP_WIDTH = 80;

export function useWindowResizeSplits() {
  const isBigScreen = useBigScreen();
  const setSplits = useSetAtom(splitsAtom);

  useEffect(() => {
    function updateSplits() {
      if (!isBigScreen) return;

      setSplits((splits) => {
        const windowWidth = window.innerWidth;
        const panelsCombined = splits.left + splits.right;
        const remainingSpaceForMap = windowWidth - panelsCombined;

        if (remainingSpaceForMap > MIN_MAP_WIDTH) {
          return splits;
        }

        const newSplits = { ...splits };

        // First try reducing the left width.
        if (windowWidth - splits.right > MIN_MAP_WIDTH) {
          newSplits.leftOpen = false;
          return newSplits;
        }
        if (windowWidth - splits.right > MIN_MAP_WIDTH) {
          newSplits.rightOpen = false;
          return newSplits;
        }

        newSplits.rightOpen = false;
        newSplits.leftOpen = false;

        return newSplits;
      });
    }

    window.addEventListener("resize", updateSplits);
    return () => {
      window.removeEventListener("resize", updateSplits);
    };
  }, [setSplits, isBigScreen]);
}

/**
 * True if the window is > 640px wide.
 */
export function useBigScreen() {
  /**
   * The window is > 640px wide
   */
  return useMediaQuery({ minWidth: 640 });
}

export function solveSplits(
  splits: Splits,
  side: Side,
  newValue: number,
  isCollapseAllowed: boolean,
  onToggle?: (shown: boolean) => void,
): Splits {
  const otherSide = OTHER_SIDE[side];
  const windowWidth = window.innerWidth;
  const newSplits = { ...splits };

  if (newValue < MIN_SPLITS[side]) {
    if (isCollapseAllowed) {
      newSplits[`${side}Open`] = false;
      onToggle?.(false);
    }
  } else {
    newSplits[side] = Math.min(
      newValue,
      MAX_SPLIT,
      windowWidth - MIN_MAP_WIDTH,
    );
  }

  const thisPane = newSplits[side];
  const panelsCombined = newSplits.left + newSplits.right;
  const remainingSpaceForMap = windowWidth - panelsCombined;
  const proposedOtherSide = windowWidth - thisPane - MIN_MAP_WIDTH;

  // Maybe we've moved this panel so far out that the panels
  // will nearly overlap.
  if (remainingSpaceForMap < MIN_MAP_WIDTH) {
    if (proposedOtherSide < MIN_SPLITS[otherSide]) {
      newSplits[`${otherSide}Open`] = false;
    } else {
      newSplits[otherSide] = proposedOtherSide;
    }
  }

  return newSplits;
}

function useResize(
  side: Side,
  isCollapseAllowed: boolean,
  onToggle?: (shown: boolean) => void,
) {
  const [splits, setSplits] = useAtom(splitsAtom);
  const showPanel = splits[`${side}Open`];
  const rawSplit = useRef<number | null>(null);

  const { moveProps } = useMove({
    onMoveStart() {
      rawSplit.current = splits[side];
    },
    onMove(e) {
      if (rawSplit.current === null) return;
      rawSplit.current += side === "left" ? e.deltaX : -e.deltaX;
      const raw = Math.round(rawSplit.current);
      setSplits((splits) => {
        return solveSplits(splits, side, raw, isCollapseAllowed, onToggle);
      });
    },
    onMoveEnd() {
      rawSplit.current = null;
    },
  });

  return { moveProps, showPanel, splits };
}

const MIN_BOTTOM_HEIGHT = 80;

export const accumulateResize = (
  accumulated: number,
  growth: number,
  { min, max }: { min: number; max: number },
) => {
  const next = accumulated + growth;
  return { accumulated: next, value: Math.round(clamp(next, min, max)) };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function useResizeBottom() {
  const [splits, setSplits] = useAtom(splitsAtom);
  const rawSplit = useRef<number | null>(null);

  const { moveProps } = useMove({
    onMoveStart() {
      rawSplit.current =
        typeof splits.bottom === "number" ? splits.bottom : 300;
    },
    onMove(e) {
      if (rawSplit.current === null) return;
      const { accumulated, value } = accumulateResize(
        rawSplit.current,
        -e.deltaY,
        { min: MIN_BOTTOM_HEIGHT, max: window.innerHeight - 200 },
      );
      rawSplit.current = accumulated;
      setSplits((splits) => ({ ...splits, bottom: value }));
    },
    onMoveEnd() {
      rawSplit.current = null;
    },
  });

  return { moveProps, splits };
}

export const Resizer = memo(function ResizerInner({
  side,
  onToggle,
  isToggleAllowed = true,
}: {
  side: Side;
  onToggle?: (shown: boolean) => void;
  isToggleAllowed?: boolean;
}) {
  const { moveProps, showPanel, splits } = useResize(
    side,
    isToggleAllowed,
    onToggle,
  );

  if (!showPanel) {
    return isToggleAllowed ? <PanelToggle side={side} /> : null;
  }

  return (
    <button
      {...moveProps}
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      tabIndex={-1}
      style={{
        cursor: "col-resize",
        [side]: splits[side],
      }}
      className="absolute top-0 bottom-0 z-10
        touch-none
        flex items-center
        justify-center
        w-1
        hover-none:w-3
        bg-purple-700/0
        hover-none:bg-white/40
        hover-none:dark:bg-black/40
        hover-hover:hover:bg-purple-700
        hover-hover:dark:hover:bg-purple-700
        "
    >
      <div
        className="
        hover-hover:hidden
        h-16
        w-1
        rounded
        bg-white"
      />
    </button>
  );
});

function PanelToggle({
  side,
  onToggle,
}: {
  side: Side;
  onToggle?: (shown: boolean) => void;
}) {
  const setSplits = useSetAtom(splitsAtom);

  const togglePanel = () => {
    setSplits((splits) => {
      return {
        ...splits,
        [`${side}Open`]: !splits[`${side}Open`],
      };
    });
    onToggle?.(true);
  };

  return (
    <Tooltip
      delayDuration={700}
      content={<div className="whitespace-nowrap">Expand panel</div>}
      side="top"
    >
      <button
        type="button"
        onClick={togglePanel}
        aria-label="Show panel"
        className={clsx(
          side === "right" ? "right-0" : "left-0",
          side === "right"
            ? "border-l rounded-r-none"
            : "border-r rounded-l-none",
          `
          absolute px-0.5 py-2 top-1/2 border-t border-b
          bg-base text-default hover:bg-purple-100 border-strong dark:hover:bg-purple-700 dark:border-white
          rounded
        `,
        )}
      >
        {side === "right" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </button>
    </Tooltip>
  );
}

const RowResizer = ({
  moveProps,
}: {
  moveProps: ReturnType<typeof useMove>["moveProps"];
}) => (
  <button
    {...moveProps}
    type="button"
    role="separator"
    aria-orientation="horizontal"
    aria-label="Resize panel"
    tabIndex={-1}
    style={{ cursor: "row-resize" }}
    className="absolute top-0 left-0 right-0 -translate-y-full z-20
      touch-none
      flex items-center
      justify-center
      h-1
      hover-none:h-3
      bg-purple-700/0
      hover-none:bg-white/40
      hover-none:dark:bg-black/40
      hover-hover:hover:bg-purple-700
      hover-hover:dark:hover:bg-purple-700
      "
  >
    <div
      className="
      hover-hover:hidden
      w-16
      h-1
      rounded
      bg-white"
    />
  </button>
);

export const BottomResizer = memo(function BottomResizerInner() {
  const { moveProps } = useResizeBottom();

  return <RowResizer moveProps={moveProps} />;
});

const MIN_VERTICAL_HEIGHT = 80;

function useResizeVertical() {
  const [splits, setSplits] = useAtom(splitsAtom);
  const rawSplit = useRef<number | null>(null);

  const { moveProps } = useMove({
    onMoveStart() {
      rawSplit.current =
        typeof splits.vertical === "number" ? splits.vertical : 300;
    },
    onMove(e) {
      if (rawSplit.current === null) return;
      const { accumulated, value } = accumulateResize(
        rawSplit.current,
        -e.deltaY,
        { min: MIN_VERTICAL_HEIGHT, max: window.innerHeight - 200 },
      );
      rawSplit.current = accumulated;
      setSplits((splits) => ({ ...splits, vertical: value }));
    },
    onMoveEnd() {
      rawSplit.current = null;
    },
  });

  return { moveProps };
}

export const VerticalResizer = memo(function VerticalResizerInner() {
  const { moveProps } = useResizeVertical();

  return <RowResizer moveProps={moveProps} />;
});

const MIN_FOOTER_HEIGHT = 205;
const MAX_FOOTER_HEIGHT = 400;

export const FooterResizer = memo(function FooterResizerInner({
  height,
  onHeightChange,
}: {
  height: number;
  onHeightChange: (height: number) => void;
}) {
  const rawHeight = useRef<number | null>(null);
  const heightRef = useRef(height);
  heightRef.current = height;

  const { moveProps } = useMove({
    onMoveStart() {
      rawHeight.current = heightRef.current;
    },
    onMove(e) {
      if (rawHeight.current === null) return;
      rawHeight.current -= Math.round(e.deltaY);
      const newHeight = Math.max(
        MIN_FOOTER_HEIGHT,
        Math.min(MAX_FOOTER_HEIGHT, rawHeight.current),
      );
      onHeightChange(newHeight);
    },
    onMoveEnd() {
      rawHeight.current = null;
    },
  });

  return (
    <button
      {...moveProps}
      type="button"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize footer"
      tabIndex={-1}
      style={{ cursor: "row-resize" }}
      className="absolute top-0 left-0 right-0 h-3 -translate-y-1/2 z-20
        touch-none
        flex items-center justify-center
        group"
    >
      <div
        className="w-full h-1
          bg-purple-700 dark:bg-purple-700
          opacity-0
          group-hover:opacity-100
          pointer-events-none"
      />
    </button>
  );
});
