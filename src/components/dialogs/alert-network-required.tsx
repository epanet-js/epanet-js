import {
  DialogHeader,
  BaseModal,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { Form, Formik } from "formik";
import { SimpleDialogActions } from "src/components/dialog";
import { useShowWelcome } from "src/commands/show-welcome";
import { useTranslate } from "src/hooks/use-translate";
import { WarningIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const AlertNetworkRequiredDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const translate = useTranslate();
  const showWelcome = useShowWelcome();

  const handleChooseNetwork = () => {
    onClose();
    showWelcome({ source: "networkRequired" });
  };

  if (isModalsOn) {
    return (
      <BaseModal
        title={translate("alertNetworkRequired")}
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActionsNew
            action={translate("chooseANetwork")}
            onAction={handleChooseNetwork}
            secondary={{ action: translate("dialog.cancel"), onClick: onClose }}
          />
        }
      >
        <div className="p-4 text-sm text-gray-700">
          <p>{translate("alertNetworkRequiredDetail")}</p>
        </div>
      </BaseModal>
    );
  }

  return (
    <Formik onSubmit={handleChooseNetwork} initialValues={{}}>
      <Form>
        <DialogHeader
          title={translate("alertNetworkRequired")}
          titleIcon={WarningIcon}
          variant="warning"
        />
        <div className="text-sm">
          <p className="text-sm text-gray-700">
            {translate("alertNetworkRequiredDetail")}
          </p>
        </div>
        <SimpleDialogActions
          action={translate("chooseANetwork")}
          onClose={onClose}
        />
      </Form>
    </Formik>
  );
};
