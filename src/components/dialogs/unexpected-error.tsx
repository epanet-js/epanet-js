import { UnexpectedErrorDialogState } from "src/state/dialog";
import {
  DialogContainer,
  DialogHeader,
  SimpleDialogActions,
  BaseDialog,
  SimpleDialogActionsNew,
} from "../dialog";
import { Form, Formik } from "formik";
import { useTranslate } from "src/hooks/use-translate";
import { ErrorIcon } from "src/icons";

export const UnexpectedErrorDialog = ({
  modal,
  onClose,
  isModalsOn,
}: {
  modal: UnexpectedErrorDialogState;
  onClose: () => void;
  isModalsOn?: boolean;
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

  if (isModalsOn) {
    return (
      <BaseDialog
        title={translate("somethingWentWrong")}
        size="xs"
        isOpen={true}
        onClose={onClose}
        footer={
          <SimpleDialogActionsNew
            autoFocusSubmit={true}
            action={onRetry ? translate("tryAgain") : translate("understood")}
            onAction={handleSubmit}
            secondary={
              onRetry
                ? { action: translate("dialog.cancel"), onClick: onClose }
                : undefined
            }
          />
        }
      >
        <div className="p-4 text-sm text-gray-700">
          <p>{translate("somethingWentWrongMessage")}</p>
        </div>
      </BaseDialog>
    );
  }

  return (
    <DialogContainer size="sm">
      <DialogHeader
        title={translate("somethingWentWrong")}
        titleIcon={ErrorIcon}
        variant="danger"
      />
      <Formik onSubmit={handleSubmit} initialValues={{}}>
        <Form>
          <p className="text-sm text-gray">
            {translate("somethingWentWrongMessage")}
          </p>
          <SimpleDialogActions
            autoFocusSubmit={true}
            action={onRetry ? translate("tryAgain") : translate("understood")}
            secondary={
              onRetry
                ? {
                    action: translate("dialog.cancel"),
                    onClick: onClose,
                  }
                : undefined
            }
          />
        </Form>
      </Formik>
    </DialogContainer>
  );
};
