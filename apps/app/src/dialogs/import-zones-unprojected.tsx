import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";

export const ImportZonesUnprojectedDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("importZones.title")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions action={translate("ok")} onAction={onClose} />
      }
    >
      <div className="p-4 text-size-base">
        <p>{translate("importZones.unprojectedError")}</p>
      </div>
    </BaseDialog>
  );
};
