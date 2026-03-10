import {
  DialogHeader,
  BaseDialog,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Form, Formik } from "formik";
import { SimpleDialogActions } from "src/components/dialog";
import { WarningIcon } from "src/icons";

export const AlertScenariosNotSavedDialog = ({
  onContinue,
  onClose,
  isModalsOn,
}: {
  onContinue: () => void;
  onClose: () => void;
  isModalsOn?: boolean;
}) => {
  const translate = useTranslate();

  if (isModalsOn) {
    return (
      <BaseDialog
        title={translate("alertScenariosNotSaved")}
        size="xs"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActionsNew
            action={translate("understood")}
            onAction={() => {
              onClose();
              onContinue();
            }}
          />
        }
      >
        <div className="p-4 text-sm text-gray-700">
          <p>{translate("alertScenariosNotSavedDetail")}</p>
        </div>
      </BaseDialog>
    );
  }

  return (
    <Formik
      onSubmit={() => {
        onClose();
        onContinue();
      }}
      initialValues={{}}
    >
      <Form>
        <DialogHeader
          title={translate("alertScenariosNotSaved")}
          titleIcon={WarningIcon}
          variant="warning"
        />
        <div className="text-sm">
          <p className="text-sm text-gray-700">
            {translate("alertScenariosNotSavedDetail")}
          </p>
        </div>
        <SimpleDialogActions action={translate("understood")} />
      </Form>
    </Formik>
  );
};
