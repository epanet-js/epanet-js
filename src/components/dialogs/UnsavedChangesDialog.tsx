import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { Button } from "../elements";
import { DialogButtons } from "./simple_dialog_actions";
import { useSaveInp } from "src/hooks/use-save-inp";
import { useOpenInp } from "src/hooks/use-open-inp";
import { captureError } from "src/infra/error-tracking";

export const UnsavedChangesDialog = ({ onClose }: { onClose: () => void }) => {
  const saveInp = useSaveInp();
  const openInp = useOpenInp();

  const handleSaveAndContinue = async () => {
    const isSaved = await saveInp({ isSaveAs: true });
    if (isSaved) openInp({ needsConfirm: false }).catch(captureError);
  };

  const handleDiscardChanges = () => {
    openInp({ needsConfirm: false }).catch(captureError);
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
          onClick={handleSaveAndContinue}
        >
          {translate("saveAndContinue")}
        </Button>
        <Button type="submit" onClick={handleDiscardChanges}>
          {translate("discardChanges")}
        </Button>
        <Button type="submit" onClick={onClose}>
          {translate("cancel")}
        </Button>
      </DialogButtons>
    </>
  );
};
