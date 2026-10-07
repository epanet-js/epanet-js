import { useMemo, useState } from "react";
import { Selector } from "@epanet-js/ui-kit";
import {
  AssetId,
  buildDefaultVspFlowControl,
  buildDefaultLevelSetting,
  buildDefaultVspPressureControl,
  buildTimedSetting,
  Control,
  Patterns,
  PumpStatus,
  Tank,
  TimedSettingStep,
} from "@epanet-js/hydraulic-model";
import { Unit } from "@epanet-js/quantity";
import { useTranslate } from "src/hooks/use-translate";
import { usePermissions } from "src/hooks/use-permissions";
import { useShowPriorityAccessDialog } from "src/hooks/use-priority-access";
import { useShowControls } from "src/commands/show-controls";
import { useSelectAssetsInApp } from "src/commands/select-assets-in-app";
import { useShowPatternsLibrary } from "src/commands/show-patterns-library";
import { ExternalLinkIcon } from "src/icons";
import { InlineField, NestedSection } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { PumpTimeBasedControls } from "./pump-time-based-controls";
import { PumpLevelBasedControls } from "./pump-level-based-controls";
import { LibrarySelectRow } from "./ui-components";
import {
  VariableSpeedPumpControlsEditor,
  type VariableSpeedPumpTargets,
} from "./variable-speed-pump-controls-editor";

type ControlType =
  | "none"
  | "levelBased"
  | "timeBased"
  | "patternBased"
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

export type PumpSpeedPatternProps = {
  patterns: Patterns;
  speedPatternId: number | undefined;
  onChange: (speedPatternId: number | undefined) => void;
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
  controllingPump = null,
  hasRawControls = false,
  speedPattern,
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
  controllingPump?: { id: AssetId; label: string } | null;
  hasRawControls?: boolean;
  speedPattern?: PumpSpeedPatternProps;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const { canUseControls } = usePermissions();
  const showPriorityAccess = useShowPriorityAccessDialog();
  const showControls = useShowControls();
  const selectAssets = useSelectAssetsInApp();
  const showPatternsLibrary = useShowPatternsLibrary();

  const speedPatternId = speedPattern?.speedPatternId;
  const [isPatternBased, setIsPatternBased] = useState(
    speedPatternId !== undefined,
  );
  const [prevSpeedPatternId, setPrevSpeedPatternId] = useState(speedPatternId);
  if (speedPatternId !== prevSpeedPatternId) {
    setPrevSpeedPatternId(speedPatternId);
    if (speedPatternId !== undefined) setIsPatternBased(true);
  }

  const controlType: ControlType =
    control === null && speedPattern && isPatternBased
      ? "patternBased"
      : controlTypeFor(control);

  const typeOptions = useMemo(
    () => [
      { value: "none" as const, label: translate("none") },
      {
        value: "levelBased" as const,
        label: translate("controls.levelBased"),
        disabled: tanks.length === 0,
      },
      { value: "timeBased" as const, label: translate("controls.timeBased") },
      ...(speedPattern
        ? [
            {
              value: "patternBased" as const,
              label: translate("controls.patternBased"),
            },
          ]
        : []),
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
    [translate, tanks.length, speedPattern, variableSpeedPumpTargets],
  );

  const selectedTypeOption = typeOptions.find((o) => o.value === controlType);

  const handleTypeChange = (newValue: ControlType) => {
    if (newValue === controlType) return;
    if (newValue !== "none" && newValue !== "patternBased" && !canUseControls) {
      showPriorityAccess({ featureName: translate("controls.nativeTitle") });
      return;
    }
    if (newValue === "patternBased") {
      setIsPatternBased(true);
      if (control) onControlChange(null);
      return;
    }
    if (controlType === "patternBased") {
      setIsPatternBased(false);
      if (speedPatternId !== undefined) speedPattern?.onChange(undefined);
    }
    const previousVariableSpeed =
      control?.type === "variable-speed-pump" ? control : undefined;
    if (newValue === "pressureTarget" && variableSpeedPumpTargets) {
      const outletNode = variableSpeedPumpTargets.nodes.find(
        (node) => node.id === variableSpeedPumpTargets.outletNodeId,
      );
      if (outletNode)
        onControlChange(
          buildDefaultVspPressureControl(
            linkId,
            outletNode,
            previousVariableSpeed,
          ),
        );
      return;
    }
    if (newValue === "flowTarget") {
      onControlChange(
        buildDefaultVspFlowControl(linkId, previousVariableSpeed),
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

      {controlType === "patternBased" && speedPattern && (
        <NestedSection className="pb-2">
          <LibrarySelectRow
            name="speedPattern"
            collection={speedPattern.patterns}
            filterByType="pumpSpeed"
            libraryLabel={translate("openPatternsLibrary")}
            onOpenLibrary={() =>
              showPatternsLibrary({
                source: "pump",
                initialPatternId: speedPatternId,
                initialSection: "pumpSpeed",
              })
            }
            selected={speedPatternId ?? null}
            emptyOptionLabel={translate("none")}
            onChange={(_, newValue) => {
              const newSpeedPatternId = newValue ?? undefined;
              if (newSpeedPatternId !== speedPatternId)
                speedPattern.onChange(newSpeedPatternId);
            }}
            readOnly={readOnly}
          />
        </NestedSection>
      )}

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

      {controllingPump && (
        <button
          type="button"
          onClick={() => selectAssets([controllingPump.id])}
          className="flex items-center gap-x-1.5 py-1 text-size-base font-semibold text-orange-800 cursor-pointer"
        >
          <ExternalLinkIcon size="md" />
          <span>
            {translate(
              "controls.variableSpeed.controlledByPump",
              controllingPump.label,
            )}
          </span>
        </button>
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
