import { useAtomValue } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { EditableTextField } from "src/components/form/editable-text-field";
import { useTranslate } from "src/hooks/use-translate";

export function ZonePanel() {
  const translate = useTranslate();
  const selection = useAtomValue(selectionAtom);
  const { zones } = useAtomValue(stagingModelDerivedAtom);
  const zoneId = USelection.singleZoneId(selection);
  const zone = zoneId !== null ? zones.get(zoneId) : undefined;

  if (!zone) return null;

  return (
    <div className="flex flex-col grow overflow-hidden">
      <div className="px-3 pt-4 pb-3">
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
        <span className="text-size-base text-subtle pl-1">
          {translate("zone")}
        </span>
      </div>
    </div>
  );
}
