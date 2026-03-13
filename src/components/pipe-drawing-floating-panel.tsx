import { useAtom, useAtomValue } from "jotai";
import { dataAtom } from "src/state/data";
import { pipeDrawingDefaultsAtom } from "src/state/drawing";
import { Mode, modeAtom } from "src/state/mode";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { NumericField } from "./form/numeric-field";
import { useValueDisplay } from "src/hooks/use-value-display";
import { useRef } from "react";
import { useUserTracking } from "src/infra/user-tracking";

export const PipeDrawingFloatingPanel = () => {
  const { mode: currentMode } = useAtomValue(modeAtom);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const userTracking = useUserTracking();
  const {
    modelMetadata: { units, defaults },
  } = useAtomValue(dataAtom);
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
  const currentDiameter =
    pipeDrawingDefaults.diameter ?? systemDefaults.diameter ?? 0;
  const currentRoughness =
    pipeDrawingDefaults.roughness ?? systemDefaults.roughness ?? 0;

  const handleDiameterChange = (newValue: number) => {
    lastDiameterChange.current = Date.now();
    setPipeDrawingDefaults((prev) => ({ ...prev, diameter: newValue }));
    userTracking.capture({
      name: "pipeDrawingDefaults.changed",
      property: "diameter",
      newValue,
    });
  };

  const handleRoughnessChange = (newValue: number) => {
    lastRoughnessChange.current = Date.now();
    setPipeDrawingDefaults((prev) => ({ ...prev, roughness: newValue }));
    userTracking.capture({
      name: "pipeDrawingDefaults.changed",
      property: "roughness",
      newValue,
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

  const diameterDisplay = displayValue(currentDiameter, "diameter");
  const roughnessDisplay = displayValue(currentRoughness, "roughness");

  return (
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20
                 bg-white dark:bg-gray-900
                 shadow-lg rounded-md
                 p-3
                 border border-gray-200 dark:border-gray-700
                 hidden md:flex flex-col lg:flex-row gap-x-6 gap-y-1
                 "
    >
      <div className="flex gap-x-2 items-center">
        <label className="flex-grow text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {diameterLabel}
        </label>
        <div className="w-[4.5rem]">
          <NumericField
            key={lastDiameterChange.current + diameterDisplay}
            label={diameterLabel}
            positiveOnly={true}
            isNullable={false}
            displayValue={diameterDisplay}
            onChangeValue={handleDiameterChange}
            styleOptions={{
              padding: "md",
              textSize: "sm",
            }}
          />
        </div>
      </div>
      <div className="flex gap-x-2 items-center">
        <label className="flex-grow text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {roughnessLabel}
        </label>
        <div className="w-[4.5rem]">
          <NumericField
            key={lastRoughnessChange.current + roughnessDisplay}
            label={roughnessLabel}
            positiveOnly={true}
            isNullable={false}
            displayValue={roughnessDisplay}
            onChangeValue={handleRoughnessChange}
            styleOptions={{
              padding: "md",
              textSize: "sm",
            }}
          />
        </div>
      </div>
    </div>
  );
};
