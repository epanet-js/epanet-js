import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
import { changeDemands } from "src/hydraulic-model/model-operations/change-demands";
import { usePersistence } from "src/lib/persistence/context";
import { dataAtom } from "src/state/jotai";
import * as Popover from "@radix-ui/react-popover";
import { Button, StyledPopoverArrow, StyledPopoverContent } from "./elements";
import { Form, Formik } from "formik";
import { FieldList, VerticalField } from "./form/fields";
import { NumericField } from "./form/numeric-field";
import { translate } from "src/infra/i18n";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { GearIcon } from "@radix-ui/react-icons";

const SimulationSettings = ({ onClose }: { onClose: () => void }) => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

  const handleSumbit = useCallback(
    ({ demandMultiplier }: { demandMultiplier: number }) => {
      const moment = changeDemands(hydraulicModel, {
        demandMultiplier,
      });
      transact(moment);
      onClose();
    },
    [hydraulicModel, transact, onClose],
  );

  return (
    <Formik
      onSubmit={handleSumbit}
      initialValues={{ demandMultiplier: hydraulicModel.demands.multiplier }}
    >
      {({ values, setFieldValue }) => (
        <Form>
          <div className="flex-col space-y-4">
            <p className="text-sm font-bold text-gray-800">
              {translate("simulationSettings")}
            </p>
            <FieldList>
              <VerticalField name={translate("demandMultiplier")}>
                <NumericField
                  label={translate("demandMultiplier")}
                  displayValue={localizeDecimal(values.demandMultiplier)}
                  positiveOnly={true}
                  isNullable={false}
                  onChangeValue={(newValue) =>
                    setFieldValue("demandMultiplier", newValue)
                  }
                />
              </VerticalField>
            </FieldList>
            <Button
              tabIndex={1}
              type="submit"
              variant="primary"
              size="full-width"
            >
              {translate("save")}
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
};

export const SimulationSettingsTrigger = () => {
  const [isOpen, setOpen] = useState(false);

  return (
    <Popover.Root open={isOpen} onOpenChange={(val) => setOpen(val)}>
      <Popover.Trigger asChild>
        <Button variant="quiet">
          <GearIcon />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <StyledPopoverContent
          size="sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
          side="bottom"
          align="center"
          sideOffset={12}
        >
          <StyledPopoverArrow />
          <SimulationSettings onClose={() => setOpen(false)} />
        </StyledPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
};
