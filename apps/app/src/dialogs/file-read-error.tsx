import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export function FileReadErrorDialog({
  fileName,
  onClose,
}: {
  fileName: string;
  onClose: () => void;
}) {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("fileReadError")}
      size="xs"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={onClose}
        />
      }
    >
      <div className="p-4 text-size-base">
        <p>{translate("fileReadErrorDetail", fileName)}</p>
      </div>
    </BaseDialog>
  );
}
