import { useState } from "react";
import { useSetAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Checkbox } from "../components/form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import { userSettingsAtom } from "src/state/user-settings";

export const FilePermissionsInfoDialog = ({
  onAcknowledge,
  onClose,
}: {
  onAcknowledge: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const setUserSettings = useSetAtom(userSettingsAtom);
  const [skipFuture, setSkipFuture] = useState(false);

  const handleConfirm = () => {
    setUserSettings((prev) => ({
      ...prev,
      showFilePermissionsInfo: !skipFuture,
    }));
    onAcknowledge();
    onClose();
  };

  return (
    <BaseDialog
      title={translate("filePermissionsInfoTitle")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={handleConfirm}
          autoFocusSubmit={true}
        />
      }
    >
      <div className="p-4 space-y-3 text-size-base text-default">
        <p>{translate("filePermissionsInfoBody")}</p>
        <p className="text-size-small text-subtle">
          {translate("filePermissionsInfoFootnote")}
        </p>
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
