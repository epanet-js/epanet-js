import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const AlertScenariosNotSavedDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  const handleAction = () => {
    onClose();
    onContinue();
  };

  return (
    <BaseDialog
      title={translate("alertScenariosNotSaved")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={handleAction}
        />
      }
    >
      <div className="p-4 text-sm text-gray-700">
        <p>{translate("alertScenariosNotSavedDetail")}</p>
      </div>
    </BaseDialog>
  );
};
