import { useMemo } from "react";
import { Selector } from "@epanet-js/ui-kit";
import {
  AssetId,
  buildDefaultLevelOpening,
  LevelOpeningControl,
  Tank,
  validateLevelSetting,
} from "@epanet-js/hydraulic-model";
import { Unit } from "@epanet-js/quantity";
import { localizeDecimal } from "@epanet-js/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { InlineField, NestedSection } from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { TextField } from "src/components/form/text-field";
import { ValveControlTypeField } from "./flow-modulating-valve-controls-editor";
import {
  CheckboxRow,
  useAssetHighlight,
} from "./variable-speed-pump-controls-editor";

export type ValveLevelBasedTargets = {
  isTankValid: (tankId: AssetId) => boolean;
  tanks: Tank[];
  outletNodeId: AssetId | null;
  levelUnit: Unit;
};

const selectorStyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
} as const;

export const defaultLevelOpeningFor = (
  valveId: AssetId,
  {
    tanks,
    outletNodeId,
  }: Pick<ValveLevelBasedTargets, "tanks" | "outletNodeId">,
): LevelOpeningControl | null => {
  const tank = tanks.find((t) => t.id === outletNodeId) ?? tanks[0];
  if (!tank) return null;
  return buildDefaultLevelOpening(
    valveId,
    tank.id,
    tank.minLevel ?? 0,
    tank.maxLevel ?? 0,
  );
};

type ControlType = "none" | "levelBased";

export const PcvControlsEditor = ({
  valveId,
  control,
  targets,
  onControlChange,
  hasRawControls = false,
  readOnly = false,
}: {
  valveId: AssetId;
  control: LevelOpeningControl | null;
  targets: ValveLevelBasedTargets;
  onControlChange: (control: LevelOpeningControl | null) => void;
  hasRawControls?: boolean;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const controlType: ControlType = control ? "levelBased" : "none";
  const hasTanks = targets.tanks.length > 0;

  const typeOptions = useMemo(
    () => [
      { value: "none" as const, label: translate("none") },
      {
        value: "levelBased" as const,
        label: translate("controls.levelBased"),
        disabled: !hasTanks,
      },
    ],
    [translate, hasTanks],
  );

  const handleTypeChange = (newValue: ControlType) => {
    if (newValue === controlType) return;
    onControlChange(
      newValue === "levelBased"
        ? defaultLevelOpeningFor(valveId, targets)
        : null,
    );
  };

  return (
    <ValveControlTypeField
      options={typeOptions}
      selected={controlType}
      onChange={handleTypeChange}
      hasRawControls={hasRawControls}
      readOnly={readOnly}
    >
      {control && (
        <ValveLevelBasedControls
          control={control}
          targets={targets}
          onControlChange={onControlChange}
          readOnly={readOnly}
        />
      )}
    </ValveControlTypeField>
  );
};

export const ValveLevelBasedControls = ({
  control,
  targets,
  onControlChange,
  readOnly = false,
}: {
  control: LevelOpeningControl;
  targets: ValveLevelBasedTargets;
  onControlChange: (control: LevelOpeningControl) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const { tanks } = targets;
  const highlightTank = useAssetHighlight(tanks);

  const unit = translateUnit(targets.levelUnit);
  const withUnit = (label: string) => (unit ? `${label} (${unit})` : label);
  const openLabel = withUnit(translate("controls.levelOpening.open"));
  const closeLabel = withUnit(translate("controls.levelOpening.closed"));
  const tankLabel = translate("tank");

  const tankOptions = useMemo(
    () => tanks.map((tank) => ({ value: tank.id, label: tank.label })),
    [tanks],
  );

  const selectedTank = tanks.find((tank) => tank.id === control.tankId) ?? null;
  const isTankInvalid = !targets.isTankValid(control.tankId);

  const errors = selectedTank
    ? validateLevelSetting({
        onLevel: control.level.open,
        offLevel: control.level.close,
        minLevel: selectedTank.minLevel ?? -Infinity,
        maxLevel: selectedTank.maxLevel ?? Infinity,
      })
    : [];
  const hasOrderError = errors.includes("order");
  const hasOpenError = errors.includes("onOutOfRange") || hasOrderError;
  const hasCloseError = errors.includes("offOutOfRange") || hasOrderError;

  const handleTankChange = (tankId: AssetId) => {
    const tank = tanks.find((t) => t.id === tankId);
    if (!tank) return;
    onControlChange({
      ...buildDefaultLevelOpening(
        control.linkId,
        tank.id,
        tank.minLevel ?? 0,
        tank.maxLevel ?? 0,
        control.id,
      ),
      continuous: control.continuous,
    });
  };

  return (
    <NestedSection className="pb-2">
      <InlineField name={tankLabel} labelSize="md">
        <div
          className="w-full"
          onMouseEnter={() => highlightTank(control.tankId)}
          onMouseLeave={() => highlightTank(null)}
        >
          {readOnly ? (
            <TextField padding="md">{selectedTank?.label ?? ""}</TextField>
          ) : (
            <Selector
              ariaLabel={tankLabel}
              invalid={isTankInvalid}
              options={tankOptions}
              selected={control.tankId}
              onChange={handleTankChange}
              onActiveOptionChange={highlightTank}
              styleOptions={{
                ...selectorStyleOptions,
                variant: isTankInvalid ? "warning" : "default",
              }}
            />
          )}
        </div>
      </InlineField>
      <LevelField
        label={openLabel}
        value={control.level.open}
        hasError={hasOpenError}
        onChange={(open) =>
          onControlChange({ ...control, level: { ...control.level, open } })
        }
        readOnly={readOnly}
      />
      <LevelField
        label={closeLabel}
        value={control.level.close}
        hasError={hasCloseError}
        onChange={(close) =>
          onControlChange({ ...control, level: { ...control.level, close } })
        }
        readOnly={readOnly}
      />
      <CheckboxRow
        label={translate("controls.levelOpening.continuous")}
        checked={control.continuous}
        onChange={(continuous) => onControlChange({ ...control, continuous })}
        disabled={readOnly}
      />
    </NestedSection>
  );
};

const LevelField = ({
  label,
  value,
  hasError,
  onChange,
  readOnly,
}: {
  label: string;
  value: number;
  hasError: boolean;
  onChange: (value: number) => void;
  readOnly: boolean;
}) => (
  <InlineField name={label} labelSize="md">
    <NumericField
      label={label}
      displayValue={localizeDecimal(value)}
      commitInvalidValues
      onChangeValue={(newValue, isEmpty) => {
        if (!isEmpty) onChange(newValue);
      }}
      readOnly={readOnly}
      styleOptions={{
        padding: "md",
        ghostBorder: readOnly,
        variant: hasError ? "warning" : "default",
      }}
    />
  </InlineField>
);
