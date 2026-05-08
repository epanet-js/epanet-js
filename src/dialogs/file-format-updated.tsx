import { useState } from "react";
import { useSetAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Checkbox } from "../components/form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import { userSettingsAtom } from "src/state/user-settings";

export const FileFormatUpdatedDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const setUserSettings = useSetAtom(userSettingsAtom);
  const [skipFuture, setSkipFuture] = useState(false);

  const handleConfirm = () => {
    setUserSettings((prev) => ({
      ...prev,
      showFileFormatUpdated: !skipFuture,
    }));
    onClose();
  };

  return (
    <BaseDialog
      title={translate("fileFormatUpdated")}
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
      <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>{translate("fileFormatUpdatedBody")}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {translate("fileFormatUpdatedFootnote")}
        </p>
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            checked={skipFuture}
            onChange={() => setSkipFuture((v) => !v)}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {translate("fileFormatUpdatedDontShowAgain")}
          </span>
        </div>
      </div>
    </BaseDialog>
  );
};
