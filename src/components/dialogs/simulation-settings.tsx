import * as Dialog from "@radix-ui/react-dialog";
import { useAtom, useSetAtom } from "jotai";
import { Suspense, useCallback } from "react";
import { dialogAtom } from "src/state/dialog_state";
import {
  DefaultErrorBoundary,
  Loading,
  StyledDialogContent,
  StyledDialogOverlay,
} from "../elements";
import { GearIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import { translate } from "src/infra/i18n";
import { Form, Formik } from "formik";
import { SimulationSettings } from "src/simulation/settings";
import { NumericField } from "../form/numeric-field";
import { simulationAtom } from "src/state/jotai";
import { localizeDecimal } from "src/infra/i18n/numbers";
import SimpleDialogActions from "./simple_dialog_actions";

const useDialogState = () => {
  const setDialogState = useSetAtom(dialogAtom);

  const closeDialog = useCallback(() => {
    setDialogState(null);
  }, [setDialogState]);

  return { closeDialog };
};

export const SimulationSettingsDialog = () => {
  const { closeDialog } = useDialogState();

  const [{ settings }, setSimulation] = useAtom(simulationAtom);

  const handleSumbit = useCallback(
    (newSettings: SimulationSettings) => {
      setSimulation((prev) => ({ ...prev, settings: newSettings }));
      closeDialog();
    },
    [closeDialog],
  );

  return (
    <DialogContainer>
      <DialogHeader
        title={translate("simulationSettings")}
        titleIcon={GearIcon}
      />
      <Formik onSubmit={handleSumbit} initialValues={settings}>
        {({ values, setFieldValue }) => (
          <Form>
            <label className="block pt-2 space-y-2">
              <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
                {translate("demandMultiplier")}
              </div>

              <NumericField
                label={translate("demandMultiplier")}
                displayValue={localizeDecimal(values.demandMultiplier)}
                onChangeValue={(newValue) =>
                  setFieldValue("demandMultiplier", newValue)
                }
              />
            </label>
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

const DialogContainer = ({ children }: { children: React.ReactNode }) => {
  const { closeDialog } = useDialogState();

  return (
    <Dialog.Root
      open={!!children}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          closeDialog();
        }
      }}
    >
      {/** Weird as hell shit here. Without this trigger, radix will
      return focus to the body element, which will not receive events. */}
      <Dialog.Trigger className="hidden">
        <div className="hidden"></div>
      </Dialog.Trigger>
      <Dialog.Portal>
        <StyledDialogOverlay />
        <Suspense fallback={<Loading />}>
          {/**radix complains if no title, so at least having an empty one helps**/}
          <Dialog.Title></Dialog.Title>
          {/**radix complains if no description, so at least having an empty one helps**/}
          <Dialog.Description></Dialog.Description>
          <StyledDialogContent
            onEscapeKeyDown={(e) => {
              closeDialog();
              e.preventDefault();
              e.stopPropagation();
            }}
            onOpenAutoFocus={(e) => e.preventDefault()}
            size={"sm"}
          >
            <DefaultErrorBoundary>{children}</DefaultErrorBoundary>
          </StyledDialogContent>
        </Suspense>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
