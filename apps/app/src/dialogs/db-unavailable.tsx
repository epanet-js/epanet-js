import { useState } from "react";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useRebuildDb } from "src/hooks/persistence/use-rebuild-db";

export const DbUnavailableDialog = () => {
  const translate = useTranslate();
  const rebuildDb = useRebuildDb();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    void rebuildDb().finally(() => setIsRetrying(false));
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <BaseDialog
      title={translate("dbUnavailable.title")}
      size="sm"
      isOpen={true}
      onClose={() => {}}
      preventClose
      footer={
        <SimpleDialogActions
          action={translate("dbUnavailable.tryAgain")}
          onAction={handleRetry}
          isDisabled={isRetrying}
          tertiary={{
            action: translate("dbUnavailable.reload"),
            onClick: handleReload,
            variant: "danger",
          }}
        />
      }
    >
      <div className="p-4 space-y-3">
        <p className="text-size-base text-default">
          {translate("dbUnavailable.description")}
        </p>
      </div>
    </BaseDialog>
  );
};
