import { useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Checkbox } from "../components/form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import { userSettingsAtom } from "src/state/user-settings";

export const FilePermissionsInfoDialog = ({
  intent = "read",
  onAcknowledge,
  onCancel,
  onClose,
}: {
  intent?: "read" | "write";
  onAcknowledge: () => void;
  onCancel?: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const setUserSettings = useSetAtom(userSettingsAtom);
  const [skipFuture, setSkipFuture] = useState(false);
  const confirmedRef = useRef(false);

  const isWrite = intent === "write";
  const title = isWrite
    ? translate("filePermissionsInfoWriteTitle")
    : translate("filePermissionsInfoTitle");
  const body = isWrite
    ? translate("filePermissionsInfoWriteBody")
    : translate("filePermissionsInfoBody");
  const footnote = isWrite
    ? translate("filePermissionsInfoWriteFootnote")
    : translate("filePermissionsInfoFootnote");

  const handleConfirm = () => {
    confirmedRef.current = true;
    setUserSettings((prev) => ({
      ...prev,
      showFilePermissionsInfo: !skipFuture,
    }));
    onAcknowledge();
    onClose();
  };

  const handleClose = () => {
    if (!confirmedRef.current) onCancel?.();
    onClose();
  };

  return (
    <BaseDialog
      title={title}
      size="md"
      isOpen={true}
      onClose={handleClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={handleConfirm}
          autoFocusSubmit={true}
        />
      }
    >
      <div className="p-4 space-y-3 text-size-base text-default">
        <p>{body}</p>
        <p className="text-size-small text-subtle">{footnote}</p>
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            checked={skipFuture}
            onChange={() => setSkipFuture((v) => !v)}
          />
          <span className="text-size-base text-subtle">
            {translate("filePermissionsInfoDontShowAgain")}
          </span>
        </div>
      </div>
    </BaseDialog>
  );
};
