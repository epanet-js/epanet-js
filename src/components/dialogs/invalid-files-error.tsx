import type { ConvertResult } from "src/types/export";
import {
  DialogHeader,
  BaseDialog,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

import { SimpleDialogActions } from "src/components/dialog";
import { useShowWelcome } from "src/commands/show-welcome";
import { Form, Formik } from "formik";
import { ErrorIcon } from "src/icons";
export type OnNext = (arg0: ConvertResult | null) => void;

export function InvalidFilesErrorDialog({
  onClose,
  isModalsOn,
}: {
  onClose: () => void;
  isModalsOn?: boolean;
}) {
  const translate = useTranslate();
  const showWelcome = useShowWelcome();

  if (isModalsOn) {
    return (
      <BaseDialog
        title={translate("failedToOpenModel")}
        size="xs"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActionsNew
            autoFocusSubmit={true}
            action={translate("understood")}
            onAction={onClose}
            secondary={{
              action: translate("seeDemoNetworks"),
              onClick: () => showWelcome({ source: "invalidFilesError" }),
            }}
          />
        }
      >
        <div className="p-4 text-sm text-gray-700">
          <p>{translate("failedToOpenModelDetail")}</p>
        </div>
      </BaseDialog>
    );
  }

  return (
    <>
      <DialogHeader
        title={translate("failedToOpenModel")}
        titleIcon={ErrorIcon}
        variant="danger"
      />
      <Formik onSubmit={() => onClose()} initialValues={{}}>
        <Form>
          <div className="text-sm">
            <p>{translate("failedToOpenModelDetail")}</p>
          </div>
          <SimpleDialogActions
            autoFocusSubmit={true}
            action={translate("understood")}
            secondary={{
              action: translate("seeDemoNetworks"),
              onClick: () => showWelcome({ source: "invalidFilesError" }),
            }}
          />
        </Form>
      </Formik>
    </>
  );
}
