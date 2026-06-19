import { useMemo } from "react";
import { Selector } from "@epanet-js/ui-kit";
import {
  buildDefaultLevelSetting,
  LevelSettingControl,
  Tank,
} from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { InlineField, NestedSection } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { NumericTable, Cell } from "src/components/form/numeric-table";

const selectorStyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
} as const;

type LevelField = "onLevel" | "offLevel";

type LevelSettingError = "onOutOfRange" | "offOutOfRange" | "order";

const validateLevelSetting = (params: {
  onLevel: number;
  offLevel: number;
  minLevel: number;
  maxLevel: number;
}): LevelSettingError[] => {
  const { onLevel, offLevel, minLevel, maxLevel } = params;
  const errors: LevelSettingError[] = [];
  const inRange = (value: number) => value >= minLevel && value <= maxLevel;
  if (!inRange(onLevel)) errors.push("onOutOfRange");
  if (!inRange(offLevel)) errors.push("offOutOfRange");
  if (onLevel >= offLevel) errors.push("order");
  return errors;
};

export const PumpLevelBasedControls = ({
  control,
  tanks,
  onControlChange,
  readOnly = false,
}: {
  control: LevelSettingControl;
  tanks: Tank[];
  onControlChange: (control: LevelSettingControl) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();

  const tankOptions = useMemo(
    () => tanks.map((tank) => ({ value: tank.id, label: tank.label })),
    [tanks],
  );

  const selectedTank = tanks.find((tank) => tank.id === control.tankId) ?? null;

  const errors = selectedTank
    ? validateLevelSetting({
        onLevel: control.on.level,
        offLevel: control.off.level,
        minLevel: selectedTank.minLevel,
        maxLevel: selectedTank.maxLevel,
      })
    : [];

  const handleLevelChange = (
    field: LevelField,
    value: number,
    isEmpty: boolean,
  ) => {
    if (isEmpty) return;
    onControlChange(
      field === "onLevel"
        ? { ...control, on: { ...control.on, level: value } }
        : { ...control, off: { level: value } },
    );
  };

  const handleSettingChange = (value: number, isEmpty: boolean) => {
    if (isEmpty) return;
    onControlChange({ ...control, on: { ...control.on, setting: value } });
  };

  const handleTankChange = (tankId: number) => {
    const tank = tanks.find((t) => t.id === tankId);
    if (!tank) return;
    onControlChange(
      buildDefaultLevelSetting(
        control.linkId,
        tank.id,
        tank.minLevel,
        tank.maxLevel,
        control.on.setting,
        control.id,
      ),
    );
  };

  const hasOrderError = errors.includes("order");
  const hasOnError = errors.includes("onOutOfRange") || hasOrderError;
  const hasOffError = errors.includes("offOutOfRange") || hasOrderError;

  const cells: Array<[Cell, Cell]> = [
    [
      {
        label: `${translate("pump.on")} ${translate("controls.level")}`,
        value: control.on.level,
        hasError: hasOnError,
        handler: (newValue, isEmpty) =>
          handleLevelChange("onLevel", newValue, isEmpty),
        readOnly,
      },
      {
        label: `${translate("pump.on")} ${translate("speed")}`,
        value: control.on.setting,
        positiveOnly: true,
        handler: handleSettingChange,
        readOnly,
      },
    ],
    [
      {
        label: `${translate("pump.off")} ${translate("controls.level")}`,
        value: control.off.level,
        hasError: hasOffError,
        handler: (newValue, isEmpty) =>
          handleLevelChange("offLevel", newValue, isEmpty),
        readOnly,
      },
      {
        label: `${translate("pump.off")} ${translate("speed")}`,
        value: null,
        readOnly: true,
      },
    ],
  ];

  const messageParts: string[] = [];
  if (
    selectedTank &&
    (errors.includes("onOutOfRange") || errors.includes("offOutOfRange"))
  ) {
    messageParts.push(
      translate(
        "controls.levelValidation.outOfRange",
        localizeDecimal(selectedTank.minLevel),
        localizeDecimal(selectedTank.maxLevel),
      ),
    );
  }
  if (hasOrderError) {
    messageParts.push(translate("controls.levelValidation.onBelowOff"));
  }

  return (
    <NestedSection className="pb-2">
      <InlineField name={translate("tank")} labelSize="md">
        {readOnly ? (
          <TextField padding="md">{selectedTank?.label ?? ""}</TextField>
        ) : (
          <div className="w-full">
            <Selector
              ariaLabel={translate("tank")}
              options={tankOptions}
              selected={control.tankId}
              onChange={handleTankChange}
              styleOptions={selectorStyleOptions}
            />
          </div>
        )}
      </InlineField>
      <NumericTable
        labels={{
          horizontal: [translate("controls.level"), translate("speed")],
          vertical: [translate("pump.on"), translate("pump.off")],
        }}
        cells={cells}
      />
      {messageParts.length > 0 && (
        <p className="text-size-base font-semibold text-orange-800">
          {messageParts.join(" ")}
        </p>
      )}
    </NestedSection>
  );
};
