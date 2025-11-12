import * as CM from "@radix-ui/react-context-menu";
import React, { memo } from "react";
import type { IWrappedFeature } from "src/types";
import { GeometryActions } from "src/components/context-actions/geometry-actions";
import { CMContent } from "src/components/elements";
import { wrappedFeaturesFromMapFeatures } from "src/lib/map-component-utils";
import { useAtomValue } from "jotai";
import { Mode, modeAtom } from "src/state/jotai";

export interface ContextInfo {
  features: ReturnType<typeof wrappedFeaturesFromMapFeatures>;
  selectedFeatures: IWrappedFeature[];
  position: Pos2;
}

const EXCLUDED_MODES = [
  Mode.SELECT_RECTANGULAR,
  Mode.SELECT_POLYGONAL,
  Mode.SELECT_FREEHAND,
] as const;

const isExcludedMode = (mode: Mode): boolean =>
  EXCLUDED_MODES.includes(mode as (typeof EXCLUDED_MODES)[number]);

export const MapContextMenu = memo(function MapContextMenu({
  contextInfo,
}: {
  contextInfo: ContextInfo | null;
}) {
  const mode = useAtomValue(modeAtom);
  if (isExcludedMode(mode.mode)) return null;

  return (
    <CM.Portal>
      <CMContent>
        {contextInfo && contextInfo.selectedFeatures.length ? (
          <GeometryActions
            selectedWrappedFeatures={contextInfo.selectedFeatures}
            as="context-item"
          />
        ) : null}
      </CMContent>
    </CM.Portal>
  );
});
