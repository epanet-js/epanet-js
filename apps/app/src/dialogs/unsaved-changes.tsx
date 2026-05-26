import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useSaveInp } from "src/commands/save-inp";
import { useSaveProject } from "src/commands/save-project";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const UnsavedChangesDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const saveInp = useSaveInp();
  const saveProject = useSaveProject();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const handleSaveAndContinue = async () => {
    const isSaved = isOurFileOn
      ? await saveProject({ source: "unsavedDialog" })
      : await saveInp({ source: "unsavedDialog" });
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
      <div className="p-4 text-sm">
        <p>{translate("unsavedChangesQuestion")}</p>
      </div>
    </BaseDialog>
  );
};
