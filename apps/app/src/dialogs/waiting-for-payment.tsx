import { useCallback } from "react";
import { BaseDialog, useDialogState } from "src/components/dialog";
import { Button } from "src/components/elements";
import { checkoutSuccessNotification } from "src/components/notification-from-url";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { useWaitForPayment } from "src/hooks/use-wait-for-payment";
import { RefreshIcon } from "src/icons";

export const WaitingForPaymentDialog = () => {
  const { closeDialog } = useDialogState();
  const translate = useTranslate();

  const onPaymentDetected = useCallback(() => {
    closeDialog();
    notify(checkoutSuccessNotification(translate));
  }, [closeDialog, translate]);

  useWaitForPayment(onPaymentDetected);

  return (
    <BaseDialog
      size="xs"
      isOpen={true}
      onClose={closeDialog}
      preventClose={true}
    >
      <div className="flex flex-col items-center gap-3 p-6">
        <RefreshIcon className="animate-spin w-6 h-6 text-subtle" />
        <p className="text-size-base text-default">
          {translate("waitingForPayment")}
        </p>
        <Button variant="default" size="sm" onClick={closeDialog}>
          {translate("cancel")}
        </Button>
      </div>
    </BaseDialog>
  );
};
