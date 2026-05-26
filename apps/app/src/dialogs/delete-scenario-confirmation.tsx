import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

export const DeleteScenarioConfirmationDialog = ({
  scenarioId,
  scenarioName,
  onConfirm,
  onClose,
}: {
  scenarioId: string;
  scenarioName: string;
  onConfirm: (scenarioId: string) => void;
  onClose: () => void;
}) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();

  const handleConfirm = () => {
    userTracking.capture({
      name: "scenario.deleted",
      scenarioId,
      scenarioName,
    });
    onClose();
    onConfirm(scenarioId);
  };

  const handleCancel = () => {
    userTracking.capture({
      name: "scenario.deleteDialog.cancel",
    });
    onClose();
  };

  return (
    <BaseDialog
      title={translate("scenarios.deleteConfirmation.title")}
      size="xs"
      isOpen={true}
      onClose={handleCancel}
      footer={
        <SimpleDialogActions
          action={translate("scenarios.deleteConfirmation.confirm")}
          onAction={handleConfirm}
          actionVariant="danger"
          secondary={{
            action: translate("dialog.cancel"),
            onClick: handleCancel,
          }}
        />
      }
    >
      <div className="p-4 text-sm text-gray-700">
        <p>{translate("scenarios.deleteConfirmation.message", scenarioName)}</p>
      </div>
    </BaseDialog>
  );
};
