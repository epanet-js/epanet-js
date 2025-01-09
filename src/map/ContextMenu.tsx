import * as CM from "@radix-ui/react-context-menu";
import React, { memo } from "react";
import type { IWrappedFeature } from "src/types";
import { GeometryActions } from "src/components/context_actions/geometry_actions";
import { CMContent } from "src/components/elements";
import { wrappedFeaturesFromMapFeatures } from "src/lib/map_component_utils";

export interface ContextInfo {
  features: ReturnType<typeof wrappedFeaturesFromMapFeatures>;
  selectedFeatures: IWrappedFeature[];
  position: Pos2;
}

export const MapContextMenu = memo(function MapContextMenu({
  contextInfo,
}: {
  contextInfo: ContextInfo | null;
}) {
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
