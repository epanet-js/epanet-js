import { useCallback, useMemo, useState } from "react";
import { Selector } from "@epanet-js/ui-kit";
import { PumpStatus } from "@epanet-js/hydraulic-model";
import {
  DataGrid,
  type GridColumn,
  timeColumn,
  filterableSelectColumn,
} from "src/components/data-grid";
import { DeleteIcon } from "src/icons";
import { InlineField, NestedSection } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";

type ControlType = "none" | "timeBased";
type ControlStep = { time: number; status: PumpStatus };

const ONE_HOUR_IN_SECONDS = 3600;

const typeOptions: { value: ControlType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "timeBased", label: "Time-based" },
];

const statusOptions: { value: PumpStatus; label: string }[] = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

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
  const [controlType, setControlType] = useState<ControlType>("none");
  const [steps, setSteps] = useState<ControlStep[]>(() => [
    { time: 0, status: initialStatus },
  ]);

  const selectedTypeOption = typeOptions.find((o) => o.value === controlType);

  const columns: GridColumn<ControlStep>[] = useMemo(
    () => [
      timeColumn("time", {
        header: "Time",
        size: 80,
        emptyValue: 0,
        isReadOnly: (rowIndex) => rowIndex === 0,
      }),
      filterableSelectColumn<PumpStatus, ControlStep>("status", {
        header: "Status",
        size: 80,
        options: statusOptions,
        placeholder: "Status",
        emptyValue: "off",
        isReadOnly: (rowIndex) => rowIndex === 0,
      }),
    ],
    [],
  );

  const createRow = useCallback((): ControlStep => {
    const lastTime = steps.length > 0 ? steps[steps.length - 1].time : 0;
    return {
      time: lastTime + ONE_HOUR_IN_SECONDS,
      status: oppositeStatus(initialStatus),
    };
  }, [steps, initialStatus]);

  const handleChange = useCallback((newRows: ControlStep[]) => {
    setSteps(newRows);
  }, []);

  const handleDeleteRow = useCallback((rowIndex: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== rowIndex));
  }, []);

  const rowActions = useMemo(
    () => [
      {
        label: "Delete",
        icon: <DeleteIcon size="sm" />,
        onSelect: handleDeleteRow,
        hidden: (rowIndex: number) => rowIndex === 0,
      },
    ],
    [handleDeleteRow],
  );

  return (
    <>
      <InlineField name="Type" labelSize="md">
        {readOnly ? (
          <TextField padding="md">{selectedTypeOption?.label ?? ""}</TextField>
        ) : (
          <div className="w-full">
            <Selector
              ariaLabel="Type"
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
            data={steps}
            columns={columns}
            onChange={handleChange}
            createRow={createRow}
            rowActions={rowActions}
            addRowLabel="Add time step"
            variant="inline"
            gutterColumn="numbered"
            readOnly={readOnly}
          />
        </NestedSection>
      )}
    </>
  );
};
