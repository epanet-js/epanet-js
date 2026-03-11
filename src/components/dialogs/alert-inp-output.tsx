import {
  DialogHeader,
  BaseModal,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Form, Formik } from "formik";
import { SimpleDialogActions } from "src/components/dialog";
import { WarningIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const AlertInpOutputDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const translate = useTranslate();

  if (isModalsOn) {
    return (
      <BaseModal
        title={translate("alertInpOutput")}
        size="sm"
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
          <p className="text-base font-semibold pb-4">
            {translate("alertInpOutputSubtitle")}
          </p>
          <p>{translate("alertInpOutputDetail")}</p>
        </div>
      </BaseModal>
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
          title={translate("alertInpOutput")}
          titleIcon={WarningIcon}
          variant="warning"
        />
        <div className="text-sm">
          <p className="text-base font-semibold text-gray-700 pb-4">
            {translate("alertInpOutputSubtitle")}
          </p>
          <p className="text-sm text-gray-700">
            {translate("alertInpOutputDetail")}
          </p>
        </div>
        <SimpleDialogActions action={translate("understood")} />
      </Form>
    </Formik>
  );
};
