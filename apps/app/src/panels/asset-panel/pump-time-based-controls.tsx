import { useCallback, useMemo, useState } from "react";
import { PumpStatus, pumpStatuses } from "@epanet-js/hydraulic-model";
import {
  DataGrid,
  type GridColumn,
  timeColumn,
  filterableSelectColumn,
} from "src/components/data-grid";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";
import { NestedSection } from "src/components/form/fields";

export type ControlStep = { time: number; status: PumpStatus };

const ONE_HOUR_IN_SECONDS = 3600;

const oppositeStatus = (status: PumpStatus): PumpStatus =>
  status === "on" ? "off" : "on";

export const PumpTimeBasedControls = ({
  initialStatus,
  readOnly = false,
}: {
  initialStatus: PumpStatus;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const [extraSteps, setExtraSteps] = useState<ControlStep[]>([]);

  const data = useMemo<ControlStep[]>(
    () => [{ time: 0, status: initialStatus }, ...extraSteps],
    [initialStatus, extraSteps],
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
    ],
    [translate, statusOptions, isTimeInSequence],
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
