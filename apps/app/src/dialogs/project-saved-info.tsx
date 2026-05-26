import { useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Checkbox } from "../components/form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import { userSettingsAtom } from "src/state/user-settings";

export const ProjectSavedInfoDialog = ({
  onConfirm,
  onCancel,
  onClose,
}: {
  onConfirm: () => void;
  onCancel?: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const setUserSettings = useSetAtom(userSettingsAtom);
  const [skipFuture, setSkipFuture] = useState(false);
  const confirmedRef = useRef(false);

  const handleConfirm = () => {
    confirmedRef.current = true;
    setUserSettings((prev) => ({
      ...prev,
      showProjectSavedInfo: !skipFuture,
    }));
    onClose();
    onConfirm();
  };

  const handleClose = () => {
    if (!confirmedRef.current) onCancel?.();
    onClose();
  };

  return (
    <BaseDialog
      title={translate("projectSavedInfo")}
      size="md"
      isOpen={true}
      onClose={handleClose}
      footer={
        <SimpleDialogActions
          action={translate("gotIt")}
          onAction={handleConfirm}
        />
      }
    >
      <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <p>{translate("projectSavedInfoBody")}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {translate("projectSavedInfoFootnote")}
        </p>
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            checked={skipFuture}
            onChange={() => setSkipFuture((v) => !v)}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {translate("projectSavedInfoDontShowAgain")}
          </span>
        </div>
      </div>
    </BaseDialog>
  );
};
