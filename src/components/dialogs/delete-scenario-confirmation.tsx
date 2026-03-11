import {
  DialogHeader,
  DialogButtons,
  BaseModal,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { Button } from "../elements";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { WarningIcon } from "src/icons";

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
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
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

  if (isModalsOn) {
    return (
      <BaseModal
        title={translate("scenarios.deleteConfirmation.title")}
        size="xs"
        isOpen={true}
        onClose={handleCancel}
        footer={
          <SimpleDialogActionsNew
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
          <p>
            {translate("scenarios.deleteConfirmation.message", scenarioName)}
          </p>
        </div>
      </BaseModal>
    );
  }

  return (
    <>
      <DialogHeader
        title={translate("scenarios.deleteConfirmation.title")}
        titleIcon={WarningIcon}
        variant="danger"
      />
      <div className="text-sm">
        <p>{translate("scenarios.deleteConfirmation.message", scenarioName)}</p>
      </div>
      <DialogButtons>
        <Button
          type="submit"
          variant="danger"
          aria-label={translate("scenarios.deleteConfirmation.confirm")}
          onClick={handleConfirm}
        >
          {translate("scenarios.deleteConfirmation.confirm")}
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
