import { BaseDialog, SimpleDialogActions } from "../components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const ChangeNotAppliedDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("changeNotApplied")}
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
      <div className="p-4">
        <p className="text-size-base text-gray">
          {translate("changeNotAppliedMessage")}
        </p>
      </div>
    </BaseDialog>
  );
};
