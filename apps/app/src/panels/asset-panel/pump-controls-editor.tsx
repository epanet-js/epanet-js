import { useCallback, useMemo, useState } from "react";
import { Selector } from "@epanet-js/ui-kit";
import { PumpStatus, pumpStatuses } from "@epanet-js/hydraulic-model";
import {
  DataGrid,
  type GridColumn,
  timeColumn,
  filterableSelectColumn,
} from "src/components/data-grid";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";
import { InlineField, NestedSection } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";

type ControlType = "none" | "timeBased";
type ControlStep = { time: number; status: PumpStatus };

const ONE_HOUR_IN_SECONDS = 3600;

const oppositeStatus = (status: PumpStatus): PumpStatus =>
  status === "on" ? "off" : "on";

const selectorStyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
} as const;

export const PumpControlsEditor = ({
  initialStatus,
  readOnly = false,
}: {
  initialStatus: PumpStatus;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const [controlType, setControlType] = useState<ControlType>("none");
  const [extraSteps, setExtraSteps] = useState<ControlStep[]>([]);

  const data = useMemo<ControlStep[]>(
    () => [{ time: 0, status: initialStatus }, ...extraSteps],
    [initialStatus, extraSteps],
  );

  const typeOptions = useMemo(
    () => [
      { value: "none" as const, label: translate("none") },
      { value: "timeBased" as const, label: translate("controls.timeBased") },
    ],
    [translate],
  );

  const statusOptions = useMemo(
    () =>
      pumpStatuses.map((status) => ({
        value: status,
        label: translate(`pump.${status}`),
      })),
    [translate],
  );

  const selectedTypeOption = typeOptions.find((o) => o.value === controlType);

  const columns: GridColumn<ControlStep>[] = useMemo(
    () => [
      timeColumn("time", {
        header: translate("controls.time"),
        size: 80,
        emptyValue: 0,
        isReadOnly: (rowIndex) => rowIndex === 0,
      }),
      filterableSelectColumn<PumpStatus, ControlStep>("status", {
        header: translate("status"),
        size: 80,
        options: statusOptions,
        placeholder: translate("status"),
        emptyValue: "off",
        isReadOnly: (rowIndex) => rowIndex === 0,
      }),
    ],
    [translate, statusOptions],
  );

  const createRow = useCallback((): ControlStep => {
    const lastTime = data.length > 0 ? data[data.length - 1].time : 0;
    return {
      time: lastTime + ONE_HOUR_IN_SECONDS,
      status: oppositeStatus(initialStatus),
    };
  }, [data, initialStatus]);

  const handleChange = useCallback((newRows: ControlStep[]) => {
    setExtraSteps(newRows.slice(1));
  }, []);

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      setExtraSteps(data.filter((_, i) => i !== rowIndex).slice(1));
    },
    [data],
  );

  const handleInsertRowAbove = useCallback(
    (rowIndex: number) => {
      const source = data[rowIndex];
      const newRow = { time: source.time, status: source.status };
      setExtraSteps(
        [...data.slice(0, rowIndex), newRow, ...data.slice(rowIndex)].slice(1),
      );
    },
    [data],
  );

  const handleInsertRowBelow = useCallback(
    (rowIndex: number) => {
      const source = data[rowIndex];
      const newRow = {
        time: source.time + ONE_HOUR_IN_SECONDS,
        status: source.status,
      };
      setExtraSteps(
        [
          ...data.slice(0, rowIndex + 1),
          newRow,
          ...data.slice(rowIndex + 1),
        ].slice(1),
      );
    },
    [data],
  );

  const rowActions = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        onSelect: handleDeleteRow,
        hidden: (rowIndex: number) => rowIndex === 0,
      },
      {
        label: translate("insertRowAbove"),
        icon: <AddIcon size="sm" />,
        onSelect: handleInsertRowAbove,
        hidden: (rowIndex: number) => rowIndex === 0,
      },
      {
        label: translate("insertRowBelow"),
        icon: <AddIcon size="sm" />,
        onSelect: handleInsertRowBelow,
      },
    ],
    [translate, handleDeleteRow, handleInsertRowAbove, handleInsertRowBelow],
  );

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
              onChange={(newValue) => setControlType(newValue)}
              styleOptions={selectorStyleOptions}
            />
          </div>
        )}
      </InlineField>

      {controlType === "timeBased" && (
        <NestedSection className="pb-2" indentation={0}>
          <DataGrid<ControlStep>
            data={data}
            columns={columns}
            onChange={handleChange}
            createRow={createRow}
            rowActions={rowActions}
            addRowLabel={translate("controls.addTimeStep")}
            variant="inline"
            gutterColumn="numbered"
            readOnly={readOnly}
          />
        </NestedSection>
      )}
    </>
  );
};
