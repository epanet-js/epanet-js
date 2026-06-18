import { useCallback, useMemo } from "react";
import {
  PumpStatus,
  pumpStatuses,
  TimedSettingStep,
} from "@epanet-js/hydraulic-model";
import {
  DataGrid,
  type GridColumn,
  timeColumn,
  filterableSelectColumn,
  floatColumn,
} from "src/components/data-grid";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";
import { NestedSection } from "src/components/form/fields";

export type ControlStep = { time: number; status: PumpStatus; setting: number };

const ONE_HOUR_IN_SECONDS = 3600;

const oppositeStatus = (status: PumpStatus): PumpStatus =>
  status === "on" ? "off" : "on";

export const PumpTimeBasedControls = ({
  initialStatus,
  initialSpeed,
  steps,
  onStepsChange,
  readOnly = false,
}: {
  initialStatus: PumpStatus;
  initialSpeed: number;
  steps: TimedSettingStep[];
  onStepsChange: (steps: TimedSettingStep[] | null) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();

  const data = useMemo<ControlStep[]>(
    () => [{ time: 0, status: initialStatus, setting: initialSpeed }, ...steps],
    [initialStatus, initialSpeed, steps],
  );

  const persist = useCallback(
    (rows: ControlStep[]) => {
      onStepsChange(
        rows.slice(1).map((row) => ({
          time: row.time,
          status: row.status,
          setting: row.setting,
        })),
      );
    },
    [onStepsChange],
  );

  const statusOptions = useMemo(
    () =>
      pumpStatuses.map((status) => ({
        value: status,
        label: translate(`pump.${status}`),
      })),
    [translate],
  );

  const isTimeInSequence = useCallback(
    (value: number, rowIndex: number) => {
      const prev = rowIndex > 0 ? data[rowIndex - 1].time : -Infinity;
      const next =
        rowIndex < data.length - 1 ? data[rowIndex + 1].time : Infinity;
      return value >= prev && value <= next;
    },
    [data],
  );

  const columns: GridColumn<ControlStep>[] = useMemo(
    () => [
      timeColumn("time", {
        header: translate("controls.time"),
        size: 80,
        emptyValue: 0,
        isReadOnly: (rowIndex) => rowIndex === 0,
        validate: isTimeInSequence,
      }),
      filterableSelectColumn<PumpStatus, ControlStep>("status", {
        header: translate("status"),
        size: 80,
        options: statusOptions,
        placeholder: translate("status"),
        emptyValue: "off",
        isReadOnly: (rowIndex) => rowIndex === 0,
      }),
      floatColumn("setting", {
        header: translate("speed"),
        size: 80,
        positiveOnly: true,
        emptyValue: initialSpeed,
        isReadOnly: (rowIndex) =>
          rowIndex === 0 || data[rowIndex]?.status === "off",
      }),
    ],
    [translate, statusOptions, isTimeInSequence, initialSpeed, data],
  );

  const createRow = useCallback((): ControlStep => {
    const lastTime = data.length > 0 ? data[data.length - 1].time : 0;
    return {
      time: lastTime + ONE_HOUR_IN_SECONDS,
      status: oppositeStatus(initialStatus),
      setting: initialSpeed,
    };
  }, [data, initialStatus, initialSpeed]);

  const handleChange = useCallback(
    (newRows: ControlStep[]) => {
      persist(newRows);
    },
    [persist],
  );

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      persist(data.filter((_, i) => i !== rowIndex));
    },
    [data, persist],
  );

  const handleInsertRowAbove = useCallback(
    (rowIndex: number) => {
      const source = data[rowIndex];
      const newRow = { ...source };
      persist([...data.slice(0, rowIndex), newRow, ...data.slice(rowIndex)]);
    },
    [data, persist],
  );

  const handleInsertRowBelow = useCallback(
    (rowIndex: number) => {
      const source = data[rowIndex];
      const newRow = { ...source, time: source.time + ONE_HOUR_IN_SECONDS };
      persist([
        ...data.slice(0, rowIndex + 1),
        newRow,
        ...data.slice(rowIndex + 1),
      ]);
    },
    [data, persist],
  );

  const rowActions = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        onSelect: handleDeleteRow,
        hidden: (rowIndex: number) => rowIndex === 0,
        variant: "destructive" as const,
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
  );
};
