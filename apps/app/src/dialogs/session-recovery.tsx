import { useMemo, useState } from "react";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { recoverableSessionsAtom } from "src/state/session-recovery";
import type { RecoveryFingerprint } from "src/infra/session-recovery";
import {
  useRecoverSession,
  useDiscardRecoverableSession,
  useIgnoreRecoverableSessions,
} from "src/commands/recover-session";

export const SessionRecoveryDialog = () => {
  const sessions = useAtomValue(recoverableSessionsAtom);
  const recoverSession = useRecoverSession();
  const discardSessions = useDiscardRecoverableSession();
  const ignoreSessions = useIgnoreRecoverableSessions();

  if (sessions.length === 0) return null;

  return (
    <SessionsRecovery
      sessions={sessions}
      onRecover={recoverSession}
      onIgnore={ignoreSessions}
      onDiscardAll={discardSessions}
    />
  );
};

export const SessionsRecovery = ({
  sessions,
  onRecover,
  onIgnore,
  onDiscardAll,
}: {
  sessions: RecoveryFingerprint[];
  onRecover: (session: RecoveryFingerprint) => void;
  onIgnore: () => void;
  onDiscardAll: () => void;
}) => {
  const translate = useTranslate();
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => b.timestampLastModelChange - a.timestampLastModelChange,
      ),
    [sessions],
  );
  const selectedSession =
    sortedSessions.find((session) => session.poolId === selectedPoolId) ?? null;

  return (
    <BaseDialog
      title={translate("restoreUnsavedWorkTitle")}
      size="sm"
      isOpen={true}
      onClose={onIgnore}
      footer={
        <SimpleDialogActions
          action={translate("restoreUnsavedWorkRecoverAction")}
          onAction={() => {
            if (!selectedSession) return;
            setIsRecovering(true);
            onRecover(selectedSession);
          }}
          isDisabled={!selectedSession}
          isSubmitting={isRecovering}
          secondary={{
            action: translate("restoreUnsavedWorkLaterAction"),
            onClick: onIgnore,
          }}
          tertiary={{
            action: translate("restoreUnsavedWorkDiscardAllAction"),
            onClick: onDiscardAll,
          }}
        />
      }
    >
      <div className="p-4 flex flex-col gap-4 text-size-base text-default">
        <p>
          {translate("restoreUnsavedWorkSessionsDescription", sessions.length)}
        </p>
        <div
          role="radiogroup"
          aria-label={translate("restoreUnsavedWorkTitle")}
          className="flex flex-col border rounded-md max-h-72 overflow-y-auto"
        >
          {sortedSessions.map((session) => (
            <SessionOption
              key={session.poolId}
              session={session}
              isSelected={session.poolId === selectedPoolId}
              onSelect={() => setSelectedPoolId(session.poolId)}
            />
          ))}
        </div>
      </div>
    </BaseDialog>
  );
};

const SessionOption = ({
  session,
  isSelected,
  onSelect,
}: {
  session: RecoveryFingerprint;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const translate = useTranslate();

  const projectName = session.projectName ?? translate("recoveredModelName");
  const lastChange = formatTimestamp(session.timestampLastModelChange);
  const lastSave =
    session.timestampLastSave !== undefined
      ? formatTimestamp(session.timestampLastSave)
      : translate("restoreUnsavedWorkNeverSaved");

  return (
    <label
      className={clsx(
        "flex items-start gap-x-3 px-3 py-2 border-b last:border-b-0 cursor-pointer transition-colors",
        isSelected ? "bg-accent-tint" : "hover:bg-panel",
      )}
    >
      <input
        type="radio"
        name="recoverableSession"
        className="mt-1 h-4 w-4 shrink-0 text-accent-hover border-strong focus:ring-accent"
        value={session.poolId}
        checked={isSelected}
        onChange={onSelect}
      />
      <span className="flex flex-col min-w-0 gap-y-0.5">
        <span className="font-medium truncate" title={projectName}>
          {projectName}
        </span>
        <span className="text-size-small text-subtle tabular-nums">
          {translate("restoreUnsavedWorkLastChange")} {lastChange}
        </span>
        <span className="text-size-small text-subtle tabular-nums">
          {translate("restoreUnsavedWorkLastSave")} {lastSave}
        </span>
      </span>
    </label>
  );
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString("en-GB")} ${date.toLocaleTimeString("en-GB")}`;
};
