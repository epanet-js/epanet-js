import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const RecalculateAllElevationsConfirmDialog = ({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  const handleConfirm = () => {
    onClose();
    onConfirm();
  };

  return (
    <BaseDialog
      title={translate("elevations.recompute.confirmAllTitle")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("elevations.recompute.confirmAllAction")}
          actionVariant="danger"
          onAction={handleConfirm}
          onClose={onClose}
        />
      }
    >
      <div className="p-4 text-size-base">
        <p>{translate("elevations.recompute.confirmAllMessage")}</p>
      </div>
    </BaseDialog>
  );
};
