import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { DialogHeader, DialogButtons } from "src/components/dialog";
import { Button } from "../elements";
import { useUserTracking } from "src/infra/user-tracking";

export const ImportCustomerPointsWarningDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const userTracking = useUserTracking();

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
    <>
      <DialogHeader
        title="Import Customer Points"
        titleIcon={ExclamationTriangleIcon}
        variant="danger"
      />
      <div className="text-sm">
        <p>
          This will <strong>permanently delete</strong> all existing customer
          points and replace them with the points from your new import.
        </p>
        <p className="mt-2">Are you sure you want to proceed?</p>
      </div>
      <DialogButtons>
        <Button
          type="submit"
          autoFocus
          variant="destructive"
          aria-label="Delete and Import"
          onClick={handleProceed}
        >
          Delete and Import
        </Button>
        <Button variant="default" onClick={handleCancel}>
          Cancel
        </Button>
      </DialogButtons>
    </>
  );
};
