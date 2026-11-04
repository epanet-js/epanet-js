import { useAtomValue } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { EditableTextField } from "src/components/form/editable-text-field";
import { useTranslate } from "src/hooks/use-translate";
import { ActionsBar } from "src/components/actions-bar";
import type { Action } from "src/components/action-button";
import { useZoomToSelection } from "src/commands/zoom-to-selection";
import { useSelectZoneContents } from "src/commands/select-zone-contents";
import { PolygonalSelectionIcon, ZoomToIcon } from "src/icons";

export function ZonePanel() {
  const translate = useTranslate();
  const selection = useAtomValue(selectionAtom);
  const zoomToSelection = useZoomToSelection();
  const selectZoneContents = useSelectZoneContents();
  const { zones } = useAtomValue(stagingModelDerivedAtom);
  const zoneId = USelection.singleZoneId(selection);
  const zone = zoneId !== null ? zones.get(zoneId) : undefined;

  if (!zone) return null;

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

  return (
    <div className="flex flex-col grow overflow-hidden">
      <div className="px-3 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <EditableTextField
              label={zone.label}
              value={zone.label}
              readOnly={true}
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
            actions={[zoomToAction, selectContentsAction]}
            className="h-8"
          />
        </div>
        <span className="text-size-base text-subtle pl-1">
          {translate("zone")}
        </span>
      </div>
    </div>
  );
}
