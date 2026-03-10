import { useState } from "react";
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

export const UnsavedChangesDialog = ({
  onContinue,
  onClose,
  isModalsOn,
}: {
  onContinue: () => void;
  onClose: () => void;
  isModalsOn?: boolean;
}) => {
  const translate = useTranslate();
  const saveInp = useSaveInp();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    const isSaved = await saveInp({ source: "unsavedDialog" });
    setIsSaving(false);
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
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActionsNew
            action={translate("saveAndContinue")}
            onAction={handleSaveAndContinue}
            isSubmitting={isSaving}
            secondary={{
              action: translate("dialog.discardChanges"),
              onClick: handleDiscardChanges,
            }}
            tertiary={{ action: translate("dialog.cancel"), onClick: onClose }}
          />
        }
      >
        <div className="p-4 text-sm text-gray-700">
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
