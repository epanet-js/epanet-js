import { DialogHeader, DialogButtons } from "src/components/dialog";
import { Button } from "../elements";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
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
          aria-label={translate("cancel")}
          onClick={handleCancel}
        >
          {translate("cancel")}
        </Button>
      </DialogButtons>
    </>
  );
};
