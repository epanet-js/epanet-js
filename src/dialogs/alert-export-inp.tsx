import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const AlertExportInpDialog = ({
  onSaveProject,
  onExportAnyway,
  onClose,
}: {
  onSaveProject: () => void;
  onExportAnyway: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("alertExportInp")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("exportToInp")}
          onAction={() => {
            onClose();
            onExportAnyway();
          }}
          secondary={{
            action: translate("saveAsProject"),
            onClick: () => {
              onClose();
              onSaveProject();
            },
          }}
        />
      }
    >
      <div className="p-4 text-sm text-gray-700">
        <p>{translate("alertExportInpDetail")}</p>
      </div>
    </BaseDialog>
  );
};
