import { useSetAtom } from "jotai";
import { Trans } from "react-i18next";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { dialogAtom } from "src/state/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

export const PriorityAccessDialog = ({
  featureName,
  onClose,
}: {
  featureName: string;
  onClose: () => void;
}) => {
  const setDialog = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();

  const handleDismiss = () => {
    userTracking.capture({
      name: "priorityAccess.dismissed",
      featureName,
    });
    onClose();
  };

  const handleUpgrade = () => {
    userTracking.capture({
      name: "priorityAccess.clickedUpgrade",
      featureName,
    });
    setDialog({
      type: "upgrade",
      source: { kind: "priorityAccess", featureName },
    });
  };

  return (
    <BaseDialog
      title={translate("priorityAccess.title")}
      size="md"
      isOpen={true}
      onClose={handleDismiss}
      footer={
        <SimpleDialogActions
          action={translate("priorityAccess.upgrade")}
          onAction={handleUpgrade}
          secondary={{
            action: translate("priorityAccess.maybeLater"),
            onClick: handleDismiss,
          }}
        />
      }
    >
      <div className="p-4 space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <p>
          <Trans
            i18nKey="priorityAccess.description1"
            values={{ 1: featureName }}
            components={{ bold: <strong /> }}
          />
        </p>
        <p>
          <Trans
            i18nKey="priorityAccess.description2"
            values={{ 1: featureName }}
            components={{ bold: <strong />, italic: <em /> }}
          />
        </p>
      </div>
    </BaseDialog>
  );
};
