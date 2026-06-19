import { useMemo } from "react";
import { Selector } from "@epanet-js/ui-kit";
import {
  AssetId,
  buildDefaultLevelSetting,
  buildTimedSetting,
  Control,
  PumpStatus,
  Tank,
  TimedSettingStep,
} from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { usePermissions } from "src/hooks/use-permissions";
import { useShowPriorityAccessDialog } from "src/hooks/use-priority-access";
import { InlineField } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { PumpTimeBasedControls } from "./pump-time-based-controls";
import { PumpLevelBasedControls } from "./pump-level-based-controls";

type ControlType = "none" | "levelBased" | "timeBased";

const selectorStyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
} as const;

const controlTypeFor = (control: Control | null): ControlType => {
  if (control?.type === "level-setting") return "levelBased";
  if (control?.type === "timed-setting") return "timeBased";
  return "none";
};

export const PumpControlsEditor = ({
  linkId,
  initialStatus,
  initialSpeed,
  control,
  tanks,
  onControlChange,
  readOnly = false,
}: {
  linkId: AssetId;
  initialStatus: PumpStatus;
  initialSpeed: number;
  control: Control | null;
  tanks: Tank[];
  onControlChange: (control: Control | null) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const { canUseControls } = usePermissions();
  const showPriorityAccess = useShowPriorityAccessDialog();
  const controlType = controlTypeFor(control);

  const typeOptions = useMemo(
    () => [
      { value: "none" as const, label: translate("none") },
      {
        value: "levelBased" as const,
        label: translate("controls.levelBased"),
        disabled: tanks.length === 0,
      },
      { value: "timeBased" as const, label: translate("controls.timeBased") },
    ],
    [translate, tanks.length],
  );

  const selectedTypeOption = typeOptions.find((o) => o.value === controlType);

  const handleTypeChange = (newValue: ControlType) => {
    if (newValue !== "none" && !canUseControls) {
      showPriorityAccess({ featureName: translate("controls.nativeTitle") });
      return;
    }
    if (newValue === "timeBased") {
      onControlChange(buildTimedSetting(linkId, []));
      return;
    }
    if (newValue === "levelBased") {
      const tank = tanks[0];
      if (!tank) return;
      onControlChange(
        buildDefaultLevelSetting(
          linkId,
          tank.id,
          tank.minLevel,
          tank.maxLevel,
          initialSpeed,
        ),
      );
      return;
    }
    onControlChange(null);
  };

  const handleStepsChange = (steps: TimedSettingStep[] | null) => {
    onControlChange(
      steps === null ? null : buildTimedSetting(linkId, steps, control?.id),
    );
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

      {control?.type === "level-setting" && (
        <PumpLevelBasedControls
          control={control}
          tanks={tanks}
          onControlChange={onControlChange}
          readOnly={readOnly}
        />
      )}

      {control?.type === "timed-setting" && (
        <PumpTimeBasedControls
          initialStatus={initialStatus}
          initialSpeed={initialSpeed}
          steps={control.steps}
          onStepsChange={handleStepsChange}
          readOnly={readOnly}
        />
      )}
    </>
  );
};
