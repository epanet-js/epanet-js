import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useShowWelcome } from "src/commands/show-welcome";
import { useTranslate } from "src/hooks/use-translate";

export const AlertNetworkRequiredDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const showWelcome = useShowWelcome();

  const handleChooseNetwork = () => {
    onClose();
    showWelcome({ source: "networkRequired" });
  };

  return (
    <BaseDialog
      title={translate("alertNetworkRequired")}
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("chooseANetwork")}
          onAction={handleChooseNetwork}
          secondary={{ action: translate("dialog.cancel"), onClick: onClose }}
        />
      }
    >
      <div className="p-4 text-sm text-gray-700">
        <p>{translate("alertNetworkRequiredDetail")}</p>
      </div>
    </BaseDialog>
  );
};
