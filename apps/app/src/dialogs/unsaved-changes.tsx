import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useSaveProject } from "src/commands/save-project";

export const UnsavedChangesDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const saveProject = useSaveProject();

  const handleSaveAndContinue = async () => {
    const isSaved = await saveProject({ source: "unsavedDialog" });
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
      size="md"
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
      <div className="p-4 text-size-base">
        <p>{translate("unsavedChangesQuestion")}</p>
      </div>
    </BaseDialog>
  );
};
