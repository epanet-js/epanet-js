import type { ConvertResult } from "src/types/export";
import {
  DialogHeader,
  SimpleDialogActions,
  BaseModal,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useShowWelcome } from "src/commands/show-welcome";
import { Form, Formik } from "formik";
import { ErrorIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
export type OnNext = (arg0: ConvertResult | null) => void;

export function InvalidFilesErrorDialog({ onClose }: { onClose: () => void }) {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const translate = useTranslate();
  const showWelcome = useShowWelcome();

  if (isModalsOn) {
    return (
      <BaseModal
        title={translate("failedToOpenModel")}
        size="xs"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActionsNew
            action={translate("understood")}
            onAction={onClose}
            secondary={{
              action: translate("seeDemoNetworks"),
              onClick: () => showWelcome({ source: "invalidFilesError" }),
            }}
          />
        }
      >
        <div className="p-4 text-sm">
          <p>{translate("failedToOpenModelDetail")}</p>
        </div>
      </BaseModal>
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
