import { useAtom, useAtomValue } from "jotai";
import { numericChecks } from "src/lib/model-attributes-validation";
import { projectSettingsAtom } from "src/state/project-settings";
import { pipeDrawingDefaultsAtom } from "src/state/drawing";
import { Mode, modeAtom } from "src/state/mode";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { NumericField } from "src/components/form/numeric-field";
import { useValueDisplay } from "src/hooks/use-value-display";
import { useRef } from "react";
import { useUserTracking } from "src/infra/user-tracking";

export const MapToolbarPipeDrawing = () => {
  const { mode: currentMode } = useAtomValue(modeAtom);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const userTracking = useUserTracking();
  const { units, defaults } = useAtomValue(projectSettingsAtom);
  const { displayValue } = useValueDisplay();
  const [pipeDrawingDefaults, setPipeDrawingDefaults] = useAtom(
    pipeDrawingDefaultsAtom,
  );

  const lastDiameterChange = useRef<number>(0);
  const lastRoughnessChange = useRef<number>(0);

  if (currentMode !== Mode.DRAW_PIPE) {
    return null;
  }

  const systemDefaults = defaults.pipe;
  const isDiameterEmpty = pipeDrawingDefaults.diameter === null;
  const currentDiameter =
    pipeDrawingDefaults.diameter ?? systemDefaults.diameter ?? 0;
  const isRoughnessEmpty = pipeDrawingDefaults.roughness === null;
  const currentRoughness =
    pipeDrawingDefaults.roughness ?? systemDefaults.roughness ?? 0;

  const handleDiameterChange = (newValue: number, isEmpty: boolean) => {
    lastDiameterChange.current = Date.now();
    const diameter = isEmpty ? null : newValue;
    setPipeDrawingDefaults((prev) => ({ ...prev, diameter }));
    userTracking.capture({
      name: "pipeDrawingDefaults.changed",
      property: "diameter",
      newValue: diameter,
    });
  };

  const handleRoughnessChange = (newValue: number, isEmpty: boolean) => {
    lastRoughnessChange.current = Date.now();
    const roughness = isEmpty ? null : newValue;
    setPipeDrawingDefaults((prev) => ({ ...prev, roughness }));
    userTracking.capture({
      name: "pipeDrawingDefaults.changed",
      property: "roughness",
      newValue: roughness,
    });
  };

  const diameterUnit = units.diameter;
  const roughnessUnit = units.roughness;

  const diameterLabel = diameterUnit
    ? `${translate("diameter")} (${translateUnit(diameterUnit)})`
    : translate("diameter");
  const roughnessLabel = roughnessUnit
    ? `${translate("roughness")} (${translateUnit(roughnessUnit)})`
    : translate("roughness");

  const diameterDisplay = isDiameterEmpty
    ? ""
    : displayValue(currentDiameter, "diameter");
  const roughnessDisplay = isRoughnessEmpty
    ? ""
    : displayValue(currentRoughness, "roughness");

  return (
    <div className="border-t px-2 py-2 flex flex-col gap-x-4 gap-y-1 lg:flex-row lg:justify-between">
      <div className="flex gap-x-2 items-center">
        <label className="grow text-size-base text-subtle whitespace-nowrap">
          {diameterLabel}
        </label>
        <div className="w-14 [&_input]:h-8">
          <NumericField
            key={lastDiameterChange.current + diameterDisplay}
            label={diameterLabel}
            validate={numericChecks.positive}
            isRequired={true}
            commitInvalidValues
            displayValue={diameterDisplay}
            onChangeValue={handleDiameterChange}
            styleOptions={{
              padding: "sm",
              textSize: "sm",
            }}
          />
        </div>
      </div>
      <div className="flex gap-x-2 items-center">
        <label className="grow text-size-base text-subtle whitespace-nowrap">
          {roughnessLabel}
        </label>
        <div className="w-14 [&_input]:h-8">
          <NumericField
            key={lastRoughnessChange.current + roughnessDisplay}
            label={roughnessLabel}
            validate={numericChecks.positive}
            isRequired={true}
            commitInvalidValues
            displayValue={roughnessDisplay}
            onChangeValue={handleRoughnessChange}
            styleOptions={{
              padding: "sm",
              textSize: "sm",
            }}
          />
        </div>
      </div>
    </div>
  );
};
