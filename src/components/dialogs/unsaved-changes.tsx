import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useSaveInp } from "src/commands/save-inp";

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

  return (
    <BaseDialog
      title={translate("unsavedChanges")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
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
};
