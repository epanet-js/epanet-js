import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { Button } from "../elements";
import { DialogButtons } from "./simple_dialog_actions";
import { useSaveInp } from "src/hooks/use-save-inp";
import { useOpenInp } from "src/hooks/use-open-inp";

export const UnsavedChangesDialog = ({ onClose }: { onClose: () => void }) => {
  const saveInp = useSaveInp();
  const openInp = useOpenInp();

  const handleSaveAndContinue = async () => {
    await saveInp({ isSaveAs: true });
    openInp({ needsConfirm: false });
  };

  const handleDiscardChanges = () => {
    openInp({ needsConfirm: false });
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
        <Button type="submit" onClick={onClose}>
          {translate("cancel")}
        </Button>
        <Button type="submit" onClick={handleDiscardChanges}>
          {translate("discardChanges")}
        </Button>
        <Button type="submit" variant="primary" onClick={handleSaveAndContinue}>
          {translate("saveAndContinue")}
        </Button>
      </DialogButtons>
    </>
  );
};
