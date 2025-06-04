import * as Dialog from "@radix-ui/react-dialog";
import { useAtomValue, useSetAtom } from "jotai";
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
import { NumericField } from "../form/numeric-field";
import { dataAtom } from "src/state/jotai";
import { localizeDecimal } from "src/infra/i18n/numbers";
import SimpleDialogActions from "./simple_dialog_actions";
import { usePersistence } from "src/lib/persistence/context";
import { changeDemands } from "src/hydraulic-model/model-operations/change-demands";
import { FieldList, InlineField } from "../form/fields";

const useDialogState = () => {
  const setDialogState = useSetAtom(dialogAtom);

  const closeDialog = useCallback(() => {
    setDialogState(null);
  }, [setDialogState]);

  return { closeDialog };
};

export const SimulationSettingsDialog = () => {
  const { closeDialog } = useDialogState();

  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

  const handleSumbit = useCallback(
    ({ demandMultiplier }: { demandMultiplier: number }) => {
      const moment = changeDemands(hydraulicModel, {
        demandMultiplier,
      });
      transact(moment);
      closeDialog();
    },
    [hydraulicModel, transact, closeDialog],
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
              <InlineField name={translate("demandMultiplier")}>
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

const DialogContainer = ({
  size = "sm",
  children,
}: {
  size?: "sm" | "xs";
  children: React.ReactNode;
}) => {
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
            widthClasses=""
            onEscapeKeyDown={(e) => {
              closeDialog();
              e.preventDefault();
              e.stopPropagation();
            }}
            onOpenAutoFocus={(e) => e.preventDefault()}
            size={size}
          >
            <DefaultErrorBoundary>{children}</DefaultErrorBoundary>
          </StyledDialogContent>
        </Suspense>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
