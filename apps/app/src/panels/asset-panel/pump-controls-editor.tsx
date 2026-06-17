import { useMemo } from "react";
import { Selector } from "@epanet-js/ui-kit";
import { PumpStatus, TimedSettingStep } from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { InlineField } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { PumpTimeBasedControls } from "./pump-time-based-controls";

type ControlType = "none" | "timeBased";

export const settingFromPumpStatus = (status: PumpStatus): number =>
  status === "on" ? 1 : 0;

export const pumpStatusFromSetting = (setting: number): PumpStatus =>
  setting === 0 ? "off" : "on";

const selectorStyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
} as const;

export const PumpControlsEditor = ({
  initialStatus,
  steps,
  onStepsChange,
  readOnly = false,
}: {
  initialStatus: PumpStatus;
  steps: TimedSettingStep[] | null;
  onStepsChange: (steps: TimedSettingStep[] | null) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const controlType: ControlType = steps !== null ? "timeBased" : "none";

  const typeOptions = useMemo(
    () => [
      { value: "none" as const, label: translate("none") },
      { value: "timeBased" as const, label: translate("controls.timeBased") },
    ],
    [translate],
  );

  const selectedTypeOption = typeOptions.find((o) => o.value === controlType);

  const handleTypeChange = (newValue: ControlType) => {
    if (newValue === "timeBased") {
      onStepsChange([
        { time: 0, setting: settingFromPumpStatus(initialStatus) },
      ]);
    } else {
      onStepsChange(null);
    }
  };

  return (
    <>
      <InlineField name={translate("type")} labelSize="md">
        {readOnly ? (
          <TextField padding="md">{selectedTypeOption?.label ?? ""}</TextField>
        ) : (
          <div className="w-full">
            <Selector
              ariaLabel={translate("type")}
              options={typeOptions}
              selected={controlType}
              onChange={handleTypeChange}
              styleOptions={selectorStyleOptions}
            />
          </div>
        )}
      </InlineField>

      {controlType === "timeBased" && steps && (
        <PumpTimeBasedControls
          initialStatus={initialStatus}
          steps={steps}
          onStepsChange={onStepsChange}
          readOnly={readOnly}
        />
      )}
    </>
  );
};
