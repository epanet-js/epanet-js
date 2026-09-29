import { useMemo } from "react";
import { Selector } from "@epanet-js/ui-kit";
import {
  AssetId,
  buildDefaultLevelSetting,
  buildTimedSetting,
  buildVariableSpeedPump,
  Control,
  PumpStatus,
  Tank,
  TimedSettingStep,
} from "@epanet-js/hydraulic-model";
import { Unit } from "@epanet-js/quantity";
import { useTranslate } from "src/hooks/use-translate";
import { usePermissions } from "src/hooks/use-permissions";
import { useShowPriorityAccessDialog } from "src/hooks/use-priority-access";
import { useShowControls } from "src/commands/show-controls";
import { ExternalLinkIcon } from "src/icons";
import { InlineField } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { PumpTimeBasedControls } from "./pump-time-based-controls";
import { PumpLevelBasedControls } from "./pump-level-based-controls";
import {
  buildDefaultFlowTarget,
  buildDefaultPressureTarget,
  VariableSpeedPumpControlsEditor,
  type VariableSpeedPumpTargets,
} from "./variable-speed-pump-controls-editor";

type ControlType =
  | "none"
  | "levelBased"
  | "timeBased"
  | "pressureTarget"
  | "flowTarget";

const selectorStyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
} as const;

const controlTypeFor = (control: Control | null): ControlType => {
  if (control?.type === "level-setting") return "levelBased";
  if (control?.type === "timed-setting") return "timeBased";
  if (control?.type === "variable-speed-pump")
    return control.quantity === "flow" ? "flowTarget" : "pressureTarget";
  return "none";
};

export const PumpControlsEditor = ({
  linkId,
  initialStatus,
  initialSpeed,
  control,
  tanks,
  levelUnit,
  onControlChange,
  variableSpeedPumpTargets,
  hasRawControls = false,
  readOnly = false,
}: {
  linkId: AssetId;
  initialStatus: PumpStatus;
  initialSpeed: number;
  control: Control | null;
  tanks: Tank[];
  levelUnit: Unit;
  onControlChange: (control: Control | null) => void;
  variableSpeedPumpTargets?: VariableSpeedPumpTargets;
  hasRawControls?: boolean;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const { canUseControls } = usePermissions();
  const showPriorityAccess = useShowPriorityAccessDialog();
  const showControls = useShowControls();
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
      ...(variableSpeedPumpTargets
        ? [
            {
              value: "pressureTarget" as const,
              label: translate("controls.variableSpeed.pressureTarget"),
              disabled: variableSpeedPumpTargets.nodes.length === 0,
            },
            {
              value: "flowTarget" as const,
              label: translate("controls.variableSpeed.flowTarget"),
            },
          ]
        : []),
    ],
    [translate, tanks.length, variableSpeedPumpTargets],
  );

  const selectedTypeOption = typeOptions.find((o) => o.value === controlType);

  const handleTypeChange = (newValue: ControlType) => {
    if (newValue !== "none" && !canUseControls) {
      showPriorityAccess({ featureName: translate("controls.nativeTitle") });
      return;
    }
    const previousVariableSpeed =
      control?.type === "variable-speed-pump" ? control : undefined;
    if (newValue === "pressureTarget" && variableSpeedPumpTargets) {
      const data = buildDefaultPressureTarget(
        linkId,
        variableSpeedPumpTargets,
        previousVariableSpeed,
      );
      if (data) onControlChange(buildVariableSpeedPump(data));
      return;
    }
    if (newValue === "flowTarget") {
      onControlChange(
        buildVariableSpeedPump(
          buildDefaultFlowTarget(linkId, previousVariableSpeed),
        ),
      );
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
          tank.minLevel ?? 0,
          tank.maxLevel ?? 0,
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
          levelUnit={levelUnit}
          onControlChange={onControlChange}
          readOnly={readOnly}
        />
      )}

      {control?.type === "variable-speed-pump" && variableSpeedPumpTargets && (
        <VariableSpeedPumpControlsEditor
          control={control}
          targets={variableSpeedPumpTargets}
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

      {hasRawControls && (
        <button
          type="button"
          onClick={() => showControls({ source: "assetPanel" })}
          className="flex items-center gap-x-1.5 py-1 text-size-base font-semibold text-orange-800 cursor-pointer"
        >
          <ExternalLinkIcon size="md" />
          <span>{translate("controls.rawControlsDetected")}</span>
        </button>
      )}
    </>
  );
};
