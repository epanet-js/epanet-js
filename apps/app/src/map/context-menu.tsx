import * as CM from "@radix-ui/react-context-menu";
import React, { memo } from "react";
import type { IWrappedFeature } from "src/types";
import type { CustomerPoint } from "@epanet-js/hydraulic-model";
import { GeometryActions } from "src/components/context-actions/geometry-actions";
import { CMContent } from "src/components/elements";
import { wrappedFeaturesFromMapFeatures } from "src/lib/map-component-utils";

export interface ContextInfo {
  features: ReturnType<typeof wrappedFeaturesFromMapFeatures>;
  selectedFeatures: IWrappedFeature[];
  selectedCustomerPoints: CustomerPoint[];
  position: Pos2;
}

export const MapContextMenu = memo(function MapContextMenu({
  contextInfo,
}: {
  contextInfo: ContextInfo | null;
}) {
  const hasSelection =
    !!contextInfo &&
    (contextInfo.selectedFeatures.length > 0 ||
      contextInfo.selectedCustomerPoints.length > 0);

  if (!hasSelection) return null;

  return (
    <CM.Portal>
      <CMContent>
        <GeometryActions as="context-item" />
      </CMContent>
    </CM.Portal>
  );
});
