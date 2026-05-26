import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

export const ImportCustomerPointsWarningDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
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

  return (
    <BaseDialog
      title={translate("importCustomerPoints.label")}
      size="md"
      isOpen={true}
      onClose={handleCancel}
      footer={
        <SimpleDialogActions
          action={translate("importCustomerPointsWarning.deleteAndImport")}
          onAction={handleProceed}
          actionVariant="danger"
          onClose={handleCancel}
        />
      }
    >
      <div className="p-4 text-sm">
        <p>{translate("importCustomerPointsWarning.explain")}</p>
        <p className="mt-2">
          {translate("importCustomerPointsWarning.question")}
        </p>
      </div>
    </BaseDialog>
  );
};
