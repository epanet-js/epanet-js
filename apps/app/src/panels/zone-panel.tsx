import { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import {
  baseModelDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { modelFactoriesAtom } from "src/state/model-factories";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { EditableTextField } from "src/components/form/editable-text-field";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { ActionsBar } from "src/components/actions-bar";
import type { Action } from "src/components/action-button";
import { useZoomToSelection } from "src/commands/zoom-to-selection";
import { useSelectZoneContents } from "src/commands/select-zone-contents";
import { useDeleteSelection } from "src/commands/delete-selection";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import {
  BookmarkIcon,
  DeleteIcon,
  PolygonalSelectionIcon,
  ZoomToIcon,
} from "src/icons";
import { useStartCollectionDraft } from "src/commands/collection-draft";
import { changeZoneProperty } from "@epanet-js/hydraulic-model-operations";
import type { Zone } from "@epanet-js/hydraulic-model";
import { SectionList } from "src/components/form/fields";
import { SectionWrapper } from "./asset-panel/ui-components";
import {
  ElevationRangeRows,
  PressureRangeRows,
  RangeLoader,
  useZoneRanges,
} from "./zone-ranges";
import { ZoneCustomAttributesSection } from "./zone-custom-attributes-section";

export function ZonePanel() {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const selection = useAtomValue(selectionAtom);
  const zoomToSelection = useZoomToSelection();
  const selectZoneContents = useSelectZoneContents();
  const deleteSelection = useDeleteSelection();
  const startCollectionDraft = useStartCollectionDraft();
  const isEditionBlocked = useIsEditionBlocked();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const baseModel = useAtomValue(baseModelDerivedAtom);
  const worktree = useAtomValue(worktreeAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const { transact } = useModelTransaction();
  const [labelError, setLabelError] = useState<string | null>(null);
  const zoneId = USelection.singleZoneId(selection);
  const zone = zoneId !== null ? hydraulicModel.zones.get(zoneId) : undefined;

  const handleLabelChange = useCallback(
    (newLabel: string): boolean => {
      if (!zone) return false;
      if (newLabel === zone.label) {
        setLabelError(null);
        return false;
      }

      if (!labelManager.isLabelAvailable(newLabel, "zone", zone.id)) {
        setLabelError(translate("labelDuplicate"));
        userTracking.capture({ name: "zone.labelDuplicate" });
        return true;
      }

      transact(() =>
        changeZoneProperty(hydraulicModel, {
          zoneIds: [zone.id],
          property: "label",
          value: newLabel,
        }),
      );
      userTracking.capture({ name: "zone.labelChanged" });
      setLabelError(null);
      return false;
    },
    [zone, hydraulicModel, labelManager, transact, translate, userTracking],
  );

  const clearLabelError = useCallback(() => {
    setLabelError(null);
  }, []);

  if (!zone) return null;

  const isNew =
    worktree.activeBranchId !== worktree.mainId &&
    !baseModel.zones.has(zone.id);

  const zoomToAction: Action = {
    icon: <ZoomToIcon />,
    applicable: true,
    priority: 2,
    label: translate("zoomTo"),
    onSelect: function doZoomTo() {
      zoomToSelection({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  const selectContentsAction: Action = {
    icon: <PolygonalSelectionIcon />,
    applicable: true,
    priority: 1,
    label: translate("selectZoneContents"),
    onSelect: function doSelectZoneContents() {
      return selectZoneContents({ source: "toolbar" });
    },
  };

  const saveSelectionSetAction: Action = {
    icon: <BookmarkIcon />,
    applicable: true,
    label: translate("collections.selectionSets.save"),
    onSelect: function saveSelectionSet() {
      startCollectionDraft({
        kind: "selectionSets",
        source: "toolbar",
        label: "",
      });
      return Promise.resolve();
    },
  };

  const deleteAction: Action = {
    icon: <DeleteIcon />,
    applicable: true,
    priority: 0,
    label: translate("delete"),
    variant: "danger-quiet",
    disabled: isEditionBlocked,
    onSelect: function doDelete() {
      deleteSelection({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  return (
    <div className="flex flex-col grow overflow-hidden">
      <div className="px-3 pt-4 pb-3 relative">
        {isNew && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-full" />
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-1">
            <EditableTextField
              label={zone.label}
              value={zone.label}
              onChangeValue={handleLabelChange}
              onReset={clearLabelError}
              onDirty={clearLabelError}
              hasError={!!labelError}
              styleOptions={{
                padding: "sm",
                ghostBorder: true,
                fontWeight: "semibold",
                textSize: "sm",
                width: "content",
              }}
            />
          </div>
          <ActionsBar
            actions={[
              zoomToAction,
              selectContentsAction,
              saveSelectionSetAction,
              deleteAction,
            ]}
            className="h-8"
          />
        </div>
        {labelError && (
          <span className="text-size-small text-warning block mt-1 pl-1">
            {labelError}
          </span>
        )}
        <span className="text-size-base text-subtle pl-1">
          {translate("zone")}
        </span>
      </div>
      <ZoneSections key={zone.id} zone={zone} readOnly={isEditionBlocked} />
    </div>
  );
}

const ZoneSections = ({
  zone,
  readOnly,
}: {
  zone: Zone;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const isZoneCustomAttributesOn = useFeatureFlag(
    "FLAG_ZONE_CUSTOM_ATTRIBUTES",
  );
  const zoneIds = useMemo(() => [zone.id], [zone.id]);
  const { elevations, pressures, isPending } = useZoneRanges(zoneIds);

  return (
    <SectionList padding={3} overflow={true}>
      <SectionWrapper
        title={translate("modelAttributes")}
        section="modelAttributes"
      >
        {isPending ? (
          <RangeLoader />
        ) : (
          <ElevationRangeRows range={elevations} />
        )}
      </SectionWrapper>
      <SectionWrapper
        title={translate("simulationResults")}
        section="simulationResults"
      >
        {isPending ? <RangeLoader /> : <PressureRangeRows range={pressures} />}
      </SectionWrapper>
      {isZoneCustomAttributesOn && (
        <ZoneCustomAttributesSection zone={zone} readOnly={readOnly} />
      )}
    </SectionList>
  );
};
