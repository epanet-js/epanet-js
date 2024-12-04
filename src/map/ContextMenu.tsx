import * as CM from "@radix-ui/react-context-menu";
import React, { memo } from "react";
import { useSetAtom } from "jotai";
import { USelection } from "src/selection";
import { dialogAtom, selectionAtom } from "src/state/jotai";
import {
  ArrowRightIcon,
  CircleIcon,
  ClipboardCopyIcon,
} from "@radix-ui/react-icons";
import type { IWrappedFeature } from "src/types";
import { GeometryActions } from "src/components/context_actions/geometry_actions";
import {
  CMContent,
  CMSubContent,
  CMItem,
  CMSubTriggerItem,
} from "src/components/elements";
import { captureError } from "src/infra/error-tracking";
import { writeToClipboard } from "src/lib/utils";
import { stringifyFeatures } from "src/hooks/use_clipboard";
import toast from "react-hot-toast";
import { wrappedFeaturesFromMapFeatures } from "src/lib/map_component_utils";

export interface ContextInfo {
  features: ReturnType<typeof wrappedFeaturesFromMapFeatures>;
  selectedFeatures: IWrappedFeature[];
  position: Pos2;
}

function FeatureItem({ feature }: { feature: IWrappedFeature }) {
  const setSelection = useSetAtom(selectionAtom);
  return (
    <CMItem
      onSelect={() => {
        setSelection(USelection.single(feature.id));
      }}
      onFocus={() => {
        setSelection(USelection.single(feature.id));
      }}
      key={feature.id}
    >
      {feature.feature.geometry?.type}
    </CMItem>
  );
}

export const MapContextMenu = memo(function MapContextMenu({
  contextInfo,
}: {
  contextInfo: ContextInfo | null;
}) {
  const setDialogState = useSetAtom(dialogAtom);

  return (
    <CM.Portal>
      <CMContent>
        {contextInfo ? (
          <>
            {contextInfo.features.features.length ? (
              <CM.Sub>
                <CMSubTriggerItem>
                  Select
                  <ArrowRightIcon />
                </CMSubTriggerItem>
                <CMSubContent>
                  {contextInfo.features.features.map((feature) => {
                    return <FeatureItem key={feature.id} feature={feature} />;
                  })}
                </CMSubContent>
              </CM.Sub>
            ) : null}
            {contextInfo.selectedFeatures.length ? (
              <CM.Sub>
                <CMSubTriggerItem>
                  Operations
                  <ArrowRightIcon />
                </CMSubTriggerItem>

                <CMSubContent>
                  <GeometryActions
                    selectedWrappedFeatures={contextInfo.selectedFeatures}
                    as="context-item"
                  />
                </CMSubContent>
                <CMItem
                  onSelect={() => {
                    stringifyFeatures(contextInfo.selectedFeatures).ifJust(
                      ({ data, message }) => {
                        toast
                          .promise(writeToClipboard(data), {
                            loading: "Copying…",
                            error: "Failed to copy",
                            success: message,
                          })
                          .catch((e) => {
                            captureError(e);
                          });
                      },
                    );
                  }}
                >
                  Copy as GeoJSON
                  <ClipboardCopyIcon />
                </CMItem>
              </CM.Sub>
            ) : null}
          </>
        ) : null}
        <CMItem
          onSelect={() => {
            if (contextInfo) {
              setDialogState({
                type: "circle",
                position: contextInfo.position,
              });
            }
          }}
        >
          Draw circle here
          <CircleIcon />
        </CMItem>
      </CMContent>
    </CM.Portal>
  );
});
