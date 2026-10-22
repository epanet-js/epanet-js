import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useUserScripts } from "src/hooks/use-user-scripts";

export const DeleteScriptConfirmationDialog = ({
  scriptId,
  scriptName,
  onClose,
}: {
  scriptId: string;
  scriptName: string;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const { deleteScript } = useUserScripts();

  const handleConfirm = () => {
    onClose();
    deleteScript(scriptId);
  };

  return (
    <BaseDialog
      title="Delete script"
      size="xs"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action="Delete script"
          onAction={handleConfirm}
          actionVariant="danger"
          secondary={{
            action: translate("dialog.cancel"),
            onClick: onClose,
          }}
        />
      }
    >
      <div className="p-4 text-size-base text-default">
        <p>Are you sure you want to delete script "{scriptName}"?</p>
      </div>
    </BaseDialog>
  );
};
