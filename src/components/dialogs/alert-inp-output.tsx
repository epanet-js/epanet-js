import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const AlertInpOutputDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("alertInpOutput")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={() => {
            onClose();
            onContinue();
          }}
        />
      }
    >
      <div className="p-4 text-sm text-gray-700">
        <p className="text-base font-semibold pb-4">
          {translate("alertInpOutputSubtitle")}
        </p>
        <p>{translate("alertInpOutputDetail")}</p>
      </div>
    </BaseDialog>
  );
};
