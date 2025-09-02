import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "../elements";
import { DialogButtons } from "src/components/dialog";
import { useSaveInp } from "src/commands/save-inp";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { HelpIcon } from "src/icons";

export const UnsavedChangesDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const saveInp = useSaveInp();

  const handleSaveAndContinue = async () => {
    const isSaved = await saveInp({ source: "unsavedDialog" });
    if (isSaved) {
      onClose();
      onContinue();
    }
  };

  const handleDiscardChanges = () => {
    onClose();
    onContinue();
  };
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  return (
    <>
      <DialogHeader
        title={translate("unsavedChanges")}
        titleIcon={isLucideIconsOn ? HelpIcon : QuestionMarkCircledIcon}
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
