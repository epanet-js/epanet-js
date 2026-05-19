import React from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import {
  mapToolbarPositionAtom,
  mapToolbarDockedAtom,
} from "src/state/map-toolbar-settings";
import type { MapToolbarPosition } from "src/state/map-toolbar-settings";
import { splitsAtom } from "src/state/layout";
import Modes from "./modes";
import { PipeDrawingFloatingPanel } from "src/components/pipe-drawing-floating-panel";

const MAPBOX_CONTROLS_HEIGHT = 160;

export const MapToolbar = ({ disabled = false }: { disabled?: boolean }) => {
  const position = useAtomValue(mapToolbarPositionAtom);
  const docked = useAtomValue(mapToolbarDockedAtom);
  const vertical = position === "left" || position === "right";

  if (docked) {
    return (
      <DockedToolbar
        position={position}
        vertical={vertical}
        disabled={disabled}
      />
    );
  }

  return (
    <FloatingToolbar
      position={position}
      vertical={vertical}
      disabled={disabled}
    />
  );
};

function DockedToolbar({
  position,
  vertical,
  disabled,
}: {
  position: MapToolbarPosition;
  vertical: boolean;
  disabled: boolean;
}) {
  const isBottom = position === "bottom";
  const isRight = position === "right";

  if (vertical) {
    return (
      <div className="relative flex-shrink-0">
        <div
          className={clsx(
            "h-full flex flex-col items-center px-1 py-2",
            "bg-white dark:bg-gray-800",
            isRight ? "border-l" : "border-r",
            "border-gray-200 dark:border-gray-900 shadow-sm",
          )}
        >
          <Modes disabled={disabled} vertical />
        </div>
        <div
          className={clsx(
            "absolute top-1/2 -translate-y-1/2",
            isRight ? "right-full mr-1" : "left-full ml-1",
          )}
        >
          <PipeDrawingFloatingPanel floating column />
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "w-full flex flex-row items-center justify-between px-2 py-1",
        "bg-white dark:bg-gray-800",
        isBottom ? "border-t" : "border-b",
        "border-gray-200 dark:border-gray-900 shadow-sm",
      )}
    >
      <Modes disabled={disabled} />
      <PipeDrawingFloatingPanel />
    </div>
  );
}

function FloatingToolbar({
  position,
  vertical,
  disabled,
}: {
  position: MapToolbarPosition;
  vertical: boolean;
  disabled: boolean;
}) {
  const splits = useAtomValue(splitsAtom);
  const bottomPanelHeight = splits.bottomOpen ? Number(splits.bottom) : 0;

  const isBottom = position === "bottom";
  const isRight = position === "right";

  const positionStyle = useFloatingPositionStyle(position, bottomPanelHeight);

  const containerClass = clsx(
    "absolute z-[2147483647]",
    vertical
      ? "flex flex-row items-center gap-1"
      : "flex flex-col items-center gap-1",
  );

  const card = (
    <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-900 rounded-lg shadow-md px-1 py-1">
      <Modes disabled={disabled} vertical={vertical} />
    </div>
  );

  const panel = <PipeDrawingFloatingPanel column={vertical} />;
  const showPanelFirst = isBottom || isRight;

  return (
    <div className={containerClass} style={positionStyle}>
      {showPanelFirst ? panel : card}
      {showPanelFirst ? card : panel}
    </div>
  );
}

function useFloatingPositionStyle(
  position: MapToolbarPosition,
  bottomPanelHeight: number,
): React.CSSProperties {
  const vertShift = bottomPanelHeight / 2;

  switch (position) {
    case "top":
      return { top: 8, left: "50%", transform: "translateX(-50%)" };
    case "bottom":
      return {
        bottom: bottomPanelHeight + 8,
        left: "50%",
        transform: "translateX(-50%)",
      };
    case "left":
      return {
        left: 8,
        top: "50%",
        transform: `translateY(calc(-50% - ${vertShift}px))`,
      };
    case "right":
      return {
        right: 8,
        top: "50%",
        transform: `translateY(calc(-50% - ${vertShift + MAPBOX_CONTROLS_HEIGHT / 2}px))`,
      };
  }
}
