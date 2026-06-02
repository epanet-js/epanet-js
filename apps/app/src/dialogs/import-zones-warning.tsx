import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

export const ImportZonesWarningDialog = ({
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
      name: "importZones.warningDialog.proceed",
    });
    onClose();
    onContinue();
  };

  const handleCancel = () => {
    userTracking.capture({
      name: "importZones.warningDialog.cancel",
    });
    onClose();
  };

  return (
    <BaseDialog
      title={translate("importZones.title")}
      size="md"
      isOpen={true}
      onClose={handleCancel}
      footer={
        <SimpleDialogActions
          action={translate("importZones.warningDialog.deleteAndImport")}
          onAction={handleProceed}
          actionVariant="danger"
          onClose={handleCancel}
        />
      }
    >
      <div className="p-4 text-size-base">
        <p>{translate("importZones.warningDialog.explain")}</p>
        <p className="mt-2">
          {translate("importZones.warningDialog.question")}
        </p>
      </div>
    </BaseDialog>
  );
};
