import { useSetAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useUserScripts } from "src/hooks/use-user-scripts";
import { useUserTracking } from "src/infra/user-tracking";
import { scriptDraftAtom } from "src/state/scripts";

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
  const { scripts, deleteScript } = useUserScripts();
  const userTracking = useUserTracking();
  const setDraft = useSetAtom(scriptDraftAtom);

  const handleConfirm = () => {
    onClose();
    deleteScript(scriptId);
    userTracking.capture({
      name: "script.deleted",
      scriptsCount: scripts.filter((script) => script.id !== scriptId).length,
    });
    setDraft((draft) => (draft?.scriptId === scriptId ? null : draft));
  };

  return (
    <BaseDialog
      title={translate("scripting.deleteScript")}
      size="xs"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("scripting.deleteScript")}
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
        <p>{translate("scripting.deleteScriptConfirmation", scriptName)}</p>
      </div>
    </BaseDialog>
  );
};
