import { MixIcon, TrashIcon, Crosshair1Icon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import type {
  Action,
  ActionProps,
} from "src/components/context_actions/action_item";
import { ToolbarTrigger } from "src/components/context_actions";
import * as DD from "@radix-ui/react-dropdown-menu";
import {
  TContent,
  StyledTooltipArrow,
  DDContent,
  B3Variant,
} from "src/components/elements";
import { SingleActions } from "src/components/single_actions";
import { deleteFeatures } from "src/lib/map_operations_deprecated/delete_features";
import { usePersistence } from "src/lib/persistence/context";
import { selectionAtom, dataAtom } from "src/state/jotai";
import { ActionItem } from "./action_item";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useZoomTo } from "src/hooks/use_zoom_to";
import { IWrappedFeature } from "src/types";

export function useActions(
  selectedWrappedFeatures: IWrappedFeature[],
): Action[] {
  const rep = usePersistence();
  const transactDeprecated = rep.useTransactDeprecated();
  const zoomTo = useZoomTo();

  const onDelete = useAtomCallback(
    useCallback(
      async (get, set) => {
        const data = get(dataAtom);
        const { newSelection, moment } = deleteFeatures(data);
        set(selectionAtom, newSelection);
        await transactDeprecated(moment);
      },
      [transactDeprecated],
    ),
  );

  const deleteFeaturesAction = {
    label: "Delete features",
    variant: "destructive" as B3Variant,
    applicable: true,
    icon: <TrashIcon />,
    onSelect: onDelete,
  };

  const zoomToAction = {
    icon: <Crosshair1Icon />,
    applicable: true,
    label: "Zoom to",
    onSelect: function doAddInnerRing() {
      return Promise.resolve(zoomTo(selectedWrappedFeatures));
    },
  };

  return [zoomToAction, deleteFeaturesAction];
}

export function GeometryActions({
  as,
  selectedWrappedFeatures,
}: {
  as: ActionProps["as"];
  selectedWrappedFeatures: IWrappedFeature[];
}) {
  const actions = useActions(selectedWrappedFeatures);

  return (
    <>
      {as === "context-item" ? (
        <SingleActions
          selectedWrappedFeatures={selectedWrappedFeatures}
          as={as}
        />
      ) : (
        <DD.Root>
          <Tooltip.Root>
            <ToolbarTrigger aria-label="Operations">
              <MixIcon />
            </ToolbarTrigger>
            <TContent side="bottom">
              <StyledTooltipArrow />
              <div className="whitespace-nowrap">Geometry operations</div>
            </TContent>
          </Tooltip.Root>
          <DDContent align="start">
            <SingleActions
              selectedWrappedFeatures={selectedWrappedFeatures}
              as="dropdown-item"
            />
          </DDContent>
        </DD.Root>
      )}

      {actions
        .filter((action) => action.applicable)
        .map((action, i) => (
          <ActionItem as={as} key={i} action={action} />
        ))}
    </>
  );
}
