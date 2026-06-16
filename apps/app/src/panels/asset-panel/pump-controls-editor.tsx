import { useMemo, useState } from "react";
import { Selector } from "@epanet-js/ui-kit";
import { PumpStatus } from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { InlineField } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { PumpTimeBasedControls } from "./pump-time-based-controls";

type ControlType = "none" | "timeBased";

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

  const typeOptions = useMemo(
    () => [
      { value: "none" as const, label: translate("none") },
      { value: "timeBased" as const, label: translate("controls.timeBased") },
    ],
    [translate],
  );

  const selectedTypeOption = typeOptions.find((o) => o.value === controlType);

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
        <PumpTimeBasedControls
          initialStatus={initialStatus}
          readOnly={readOnly}
        />
      )}
    </>
  );
};
