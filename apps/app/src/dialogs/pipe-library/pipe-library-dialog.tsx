import { useRef } from "react";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";

export const PipeLibraryDialog = () => {
  const translate = useTranslate();
  const dialogActions = useRef<DialogActionsHandle>(null);

  return (
    <BaseDialog
      title={translate("pipeLibrary.menuLabel")}
      size="lg"
      height="xl"
      isOpen={true}
      onClose={() => dialogActions.current?.closeDialog()}
      footer={
        <DialogActions
          ref={dialogActions}
          readOnly={false}
          hasChanges={false}
        />
      }
    >
      <div className="flex-1 flex min-h-0" />
    </BaseDialog>
  );
};
