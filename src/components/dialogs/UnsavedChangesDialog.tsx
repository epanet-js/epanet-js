import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { Button } from "../elements";
import { DialogButtons } from "./simple_dialog_actions";
import { useSaveInp } from "src/hooks/use-save-inp";

export const UnsavedChangesDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const saveInp = useSaveInp();

  const handleSaveAndContinue = async () => {
    const isSaved = await saveInp();
    if (isSaved) onContinue();
  };

  const handleDiscardChanges = () => {
    onContinue();
    onClose();
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
