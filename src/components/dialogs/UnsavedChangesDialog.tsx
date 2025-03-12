import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { Button } from "../elements";
import { DialogButtons } from "./simple_dialog_actions";
import { useSaveInp } from "src/commands/save-inp";
import { isFeatureOn } from "src/infra/feature-flags";
import { useUserTracking } from "src/infra/user-tracking";

export const UnsavedChangesDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const saveInp = useSaveInp();
  const userTracking = useUserTracking();

  const handleSaveAndContinue = async () => {
    if (isFeatureOn("FLAG_TRACKING")) {
      userTracking.capture({
        name: "model.saved",
        source: "unsavedDialog",
      });
    }
    const isSaved = await saveInp();
    if (isSaved) {
      onClose();
      onContinue();
    }
  };

  const handleDiscardChanges = () => {
    onClose();
    onContinue();
  };

  return (
    <>
      <DialogHeader
        title={translate("unsavedChanges")}
        titleIcon={QuestionMarkCircledIcon}
      />
      <div className="text-sm">
        <p>{translate("unsavedChangesQuestion")}</p>
      </div>
      <DialogButtons>
        <Button
          type="submit"
          autoFocus
          variant="primary"
          aria-label={translate("saveAndContinue")}
          onClick={handleSaveAndContinue}
        >
          {translate("saveAndContinue")}
        </Button>
        <Button
          type="submit"
          aria-label={translate("discardChanges")}
          onClick={handleDiscardChanges}
        >
          {translate("discardChanges")}
        </Button>
        <Button type="submit" onClick={onClose}>
          {translate("cancel")}
        </Button>
      </DialogButtons>
    </>
  );
};
