import { useMemo } from "react";
import { Selector } from "@epanet-js/ui-kit";
import {
  buildDefaultLevelSetting,
  LevelSettingControl,
  Tank,
} from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { InlineField, NestedSection } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { NumericTable, Cell } from "src/components/form/numeric-table";

const selectorStyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
} as const;

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
      ),
    );
  };

  const cells: Array<[Cell, Cell]> = [
    [
      {
        label: `${translate("pump.on")} ${translate("controls.level")}`,
        value: control.on.level,
        handler: (newValue) =>
          onControlChange({
            ...control,
            on: { ...control.on, level: newValue },
          }),
        readOnly,
      },
      {
        label: `${translate("pump.on")} ${translate("speed")}`,
        value: control.on.setting,
        positiveOnly: true,
        handler: (newValue) =>
          onControlChange({
            ...control,
            on: { ...control.on, setting: newValue },
          }),
        readOnly,
      },
    ],
    [
      {
        label: `${translate("pump.off")} ${translate("controls.level")}`,
        value: control.off.level,
        handler: (newValue) =>
          onControlChange({ ...control, off: { level: newValue } }),
        readOnly,
      },
      {
        label: `${translate("pump.off")} ${translate("speed")}`,
        value: null,
        readOnly: true,
      },
    ],
  ];

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
    </NestedSection>
  );
};
