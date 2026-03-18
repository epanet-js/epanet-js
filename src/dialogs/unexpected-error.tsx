import { UnexpectedErrorDialogState } from "src/state/dialog";
import { BaseDialog, SimpleDialogActions } from "../components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const UnexpectedErrorDialog = ({
  modal,
  onClose,
}: {
  modal: UnexpectedErrorDialogState;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const { onRetry } = modal;

  const handleSubmit = () => {
    if (onRetry) {
      onClose();
      onRetry();
    } else {
      onClose();
    }
  };

  return (
    <BaseDialog
      title={translate("somethingWentWrong")}
      size="xs"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={onRetry ? translate("tryAgain") : translate("understood")}
          onAction={handleSubmit}
          onClose={onRetry ? onClose : undefined}
        />
      }
    >
      <div className="p-4">
        <p className="text-sm text-gray">
          {translate("somethingWentWrongMessage")}
        </p>
      </div>
    </BaseDialog>
  );
};
