"use client";
import { BaseDialog, AckDialogAction } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const ProfileNoPathDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("hglProfile.noPath.title")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <AckDialogAction onAck={onClose} label={translate("dialog.ok")} />
      }
    >
      <div className="p-4 text-sm">
        <p>{translate("hglProfile.noPath.message")}</p>
      </div>
    </BaseDialog>
  );
};
