import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const ImportSensorDataWarningDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  const handleProceed = () => {
    onClose();
    onContinue();
  };

  return (
    <BaseDialog
      title={translate("sensorData.import.title")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("sensorData.import.warningDialog.deleteAndImport")}
          onAction={handleProceed}
          actionVariant="danger"
          onClose={onClose}
        />
      }
    >
      <div className="p-4 text-size-base">
        <p>{translate("sensorData.import.warningDialog.explain")}</p>
        <p className="mt-2">
          {translate("sensorData.import.warningDialog.question")}
        </p>
      </div>
    </BaseDialog>
  );
};
