import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const AllocateCustomerPointsWarningDialog = ({
  onImport,
  onClose,
}: {
  onImport: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  const handleImport = () => {
    onClose();
    onImport();
  };

  return (
    <BaseDialog
      title={translate("allocateCustomerPoints.warningDialog.title")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate(
            "allocateCustomerPoints.warningDialog.importAction",
          )}
          onAction={handleImport}
          onClose={onClose}
        />
      }
    >
      <div className="p-4 text-size-base">
        <p>
          {translate("allocateCustomerPoints.warningDialog.noCustomerPoints")}
        </p>
      </div>
    </BaseDialog>
  );
};
