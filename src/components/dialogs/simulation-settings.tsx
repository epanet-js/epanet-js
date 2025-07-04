import { useAtomValue } from "jotai";
import { useCallback } from "react";

import { GearIcon } from "@radix-ui/react-icons";
import { DialogContainer, DialogHeader, useDialogState } from "../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Form, Formik } from "formik";
import { NumericField } from "../form/numeric-field";
import { dataAtom } from "src/state/jotai";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { SimpleDialogActions } from "src/components/dialog";
import { usePersistence } from "src/lib/persistence/context";
import { changeDemands } from "src/hydraulic-model/model-operations/change-demands";
import { FieldList, InlineField } from "../form/fields";
import { useUserTracking } from "src/infra/user-tracking";

export const SimulationSettingsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();

  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const handleSumbit = useCallback(
    ({ demandMultiplier }: { demandMultiplier: number }) => {
      userTracking.capture({
        name: "simulationSetting.changed",
        settingName: "demandMultiplier",
        newValue: demandMultiplier,
        oldValue: hydraulicModel.demands.multiplier,
      });

      const moment = changeDemands(hydraulicModel, {
        demandMultiplier,
      });
      transact(moment);
      closeDialog();
    },
    [hydraulicModel, transact, closeDialog, userTracking],
  );

  return (
    <DialogContainer size="xs">
      <DialogHeader
        title={translate("simulationSettings")}
        titleIcon={GearIcon}
      />
      <Formik
        onSubmit={handleSumbit}
        initialValues={{ demandMultiplier: hydraulicModel.demands.multiplier }}
      >
        {({ values, setFieldValue }) => (
          <Form>
            <FieldList>
              <InlineField
                layout="half-split"
                name={translate("demandMultiplier")}
              >
                <NumericField
                  label={translate("demandMultiplier")}
                  displayValue={localizeDecimal(values.demandMultiplier)}
                  positiveOnly={true}
                  isNullable={false}
                  onChangeValue={(newValue) =>
                    setFieldValue("demandMultiplier", newValue)
                  }
                />
              </InlineField>
            </FieldList>
            <SimpleDialogActions
              onClose={closeDialog}
              action={translate("save")}
            />
          </Form>
        )}
      </Formik>
    </DialogContainer>
  );
};
