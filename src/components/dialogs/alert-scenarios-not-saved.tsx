import {
  DialogHeader,
  BaseDialog,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Form, Formik } from "formik";
import { SimpleDialogActions } from "src/components/dialog";
import { WarningIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const AlertScenariosNotSavedDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const translate = useTranslate();

  if (isModalsOn) {
    const handleAction = () => {
      onClose();
      onContinue();
    };
    return (
      <BaseDialog
        title={translate("alertScenariosNotSaved")}
        size="sm"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActionsNew
            action={translate("understood")}
            onAction={handleAction}
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
