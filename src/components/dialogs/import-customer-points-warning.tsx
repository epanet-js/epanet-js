import {
  DialogHeader,
  DialogButtons,
  BaseDialog,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { Button } from "../elements";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { WarningIcon } from "src/icons";

export const ImportCustomerPointsWarningDialog = ({
  onContinue,
  onClose,
  isModalsOn,
}: {
  onContinue: () => void;
  onClose: () => void;
  isModalsOn?: boolean;
}) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();

  const handleProceed = () => {
    userTracking.capture({
      name: "importCustomerPoints.warningDialog.proceed",
    });
    onClose();
    onContinue();
  };

  const handleCancel = () => {
    userTracking.capture({
      name: "importCustomerPoints.warningDialog.cancel",
    });
    onClose();
  };

  if (isModalsOn) {
    return (
      <BaseDialog
        title={translate("importCustomerPoints.label")}
        size="xs"
        isOpen={true}
        onClose={handleCancel}
        footer={
          <SimpleDialogActionsNew
            action={translate("importCustomerPointsWarning.deleteAndImport")}
            onAction={handleProceed}
            actionVariant="danger"
            secondary={{
              action: translate("dialog.cancel"),
              onClick: handleCancel,
            }}
          />
        }
      >
        <div className="p-4 text-sm text-gray-700">
          <p>{translate("importCustomerPointsWarning.explain")}</p>
          <p className="mt-2">
            {translate("importCustomerPointsWarning.question")}
          </p>
        </div>
      </BaseDialog>
    );
  }

  return (
    <>
      <DialogHeader
        title={translate("importCustomerPoints.label")}
        titleIcon={WarningIcon}
        variant="danger"
      />
      <div className="text-sm">
        <p>{translate("importCustomerPointsWarning.explain")}</p>
        <p className="mt-2">
          {translate("importCustomerPointsWarning.question")}
        </p>
      </div>
      <DialogButtons>
        <Button
          type="submit"
          variant="danger"
          aria-label={translate("importCustomerPointsWarning.deleteAndImport")}
          onClick={handleProceed}
        >
          {translate("importCustomerPointsWarning.deleteAndImport")}
        </Button>
        <Button
          variant="default"
          aria-label={translate("dialog.cancel")}
          onClick={handleCancel}
        >
          {translate("dialog.cancel")}
        </Button>
      </DialogButtons>
    </>
  );
};
