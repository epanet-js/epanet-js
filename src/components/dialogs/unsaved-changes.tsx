import {
  DialogHeader,
  DialogButtons,
  BaseDialog,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "../elements";
import { useSaveInp } from "src/commands/save-inp";
import { HelpIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const UnsavedChangesDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
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

  if (isModalsOn) {
    return (
      <BaseDialog
        title={translate("unsavedChanges")}
        size="sm"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActionsNew
            action={translate("saveAndContinue")}
            onAction={() => void handleSaveAndContinue()}
            secondary={{
              action: translate("dialog.discardChanges"),
              onClick: handleDiscardChanges,
            }}
            onClose={onClose}
          />
        }
      >
        <div className="p-4 text-sm">
          <p>{translate("unsavedChangesQuestion")}</p>
        </div>
      </BaseDialog>
    );
  }

  return (
    <>
      <DialogHeader title={translate("unsavedChanges")} titleIcon={HelpIcon} />
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
          aria-label={translate("dialog.discardChanges")}
          onClick={handleDiscardChanges}
        >
          {translate("dialog.discardChanges")}
        </Button>
        <Button type="submit" onClick={onClose}>
          {translate("dialog.cancel")}
        </Button>
      </DialogButtons>
    </>
  );
};
