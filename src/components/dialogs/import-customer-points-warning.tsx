import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { DialogHeader, DialogButtons } from "src/components/dialog";
import { Button } from "../elements";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { WarningIcon } from "src/icons";

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

  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  return (
    <>
      <DialogHeader
        title={translate("importCustomerPoints.label")}
        titleIcon={isLucideIconsOn ? WarningIcon : ExclamationTriangleIcon}
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
          aria-label={translate("cancel")}
          onClick={handleCancel}
        >
          {translate("cancel")}
        </Button>
      </DialogButtons>
    </>
  );
};
