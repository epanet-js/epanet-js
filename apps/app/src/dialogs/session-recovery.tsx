import { useState } from "react";
import { useAtomValue } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { recoverableSessionAtom } from "src/state/session-recovery";
import {
  useRecoverSession,
  useDiscardRecoverableSession,
} from "src/commands/recover-session";

export const SessionRecoveryDialog = () => {
  const translate = useTranslate();
  const recoverableSession = useAtomValue(recoverableSessionAtom);
  const recoverSession = useRecoverSession();
  const discardSession = useDiscardRecoverableSession();
  const [isRecovering, setIsRecovering] = useState(false);

  if (!recoverableSession) return null;

  const projectName =
    recoverableSession.projectName ?? translate("recoveredModelName");
  const lastChange = formatTimestamp(
    recoverableSession.timestampLastModelChange,
  );
  const lastSave =
    recoverableSession.timestampLastSave !== undefined
      ? formatTimestamp(recoverableSession.timestampLastSave)
      : translate("restoreUnsavedWorkNeverSaved");

  return (
    <BaseDialog
      title={translate("restoreUnsavedWorkTitle")}
      size="sm"
      isOpen={true}
      onClose={discardSession}
      footer={
        <SimpleDialogActions
          action={translate("recoverChangesAction")}
          onAction={() => {
            setIsRecovering(true);
            void recoverSession();
          }}
          isSubmitting={isRecovering}
          secondary={{
            action: translate("discardChangesAction"),
            onClick: discardSession,
          }}
        />
      }
    >
      <div className="p-4 flex flex-col gap-4 text-size-base text-default">
        <p>{translate("restoreUnsavedWorkDescription")}</p>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1">
          <span className="text-subtle">
            {translate("restoreUnsavedWorkProject")}
          </span>
          <span className="font-medium truncate" title={projectName}>
            {projectName}
          </span>
          <span className="text-subtle">
            {translate("restoreUnsavedWorkLastChange")}
          </span>
          <span className="font-medium tabular-nums">{lastChange}</span>
          <span className="text-subtle">
            {translate("restoreUnsavedWorkLastSave")}
          </span>
          <span className="font-medium tabular-nums">{lastSave}</span>
        </div>
      </div>
    </BaseDialog>
  );
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString("en-GB")} ${date.toLocaleTimeString("en-GB")}`;
};
