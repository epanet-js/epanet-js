"use client";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const ImportZonesDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("importZones.title")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          secondary={{ action: translate("dialog.cancel"), onClick: onClose }}
        />
      }
    >
      <div className="p-4" />
    </BaseDialog>
  );
};
