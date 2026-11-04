import { useCallback, useState } from "react";
import { useAtomValue } from "jotai";
import {
  baseModelDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { EditableTextField } from "src/components/form/editable-text-field";
import {
  PaywallLockButton,
  PaywallOverlay,
  useFeatureLock,
} from "src/components/form/paywall";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { ActionsBar } from "src/components/actions-bar";
import type { Action } from "src/components/action-button";
import { useZoomToSelection } from "src/commands/zoom-to-selection";
import { useSelectZoneContents } from "src/commands/select-zone-contents";
import { PolygonalSelectionIcon, ZoomToIcon } from "src/icons";
import { isZoneLabelAvailable } from "@epanet-js/hydraulic-model";
import { changeZoneProperty } from "@epanet-js/hydraulic-model-operations";

export function ZonePanel() {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const selection = useAtomValue(selectionAtom);
  const zoomToSelection = useZoomToSelection();
  const selectZoneContents = useSelectZoneContents();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const baseModel = useAtomValue(baseModelDerivedAtom);
  const worktree = useAtomValue(worktreeAtom);
  const { transact } = useModelTransaction();
  const { isLocked } = useFeatureLock("zones", "rename");
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

      if (!isZoneLabelAvailable(hydraulicModel.zones, newLabel, zone.id)) {
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
    [zone, hydraulicModel, transact, translate, userTracking],
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

  const labelField = (
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
  );

  return (
    <div className="flex flex-col grow overflow-hidden">
      <div className="px-3 pt-4 pb-3 relative">
        {isNew && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-full" />
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-1">
            {isLocked ? (
              <>
                <PaywallOverlay feature="zones" ariaLabel={translate("rename")}>
                  {labelField}
                </PaywallOverlay>
                <PaywallLockButton
                  feature="zones"
                  label={translate("rename")}
                />
              </>
            ) : (
              labelField
            )}
          </div>
          <ActionsBar
            actions={[zoomToAction, selectContentsAction]}
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
    </div>
  );
}
