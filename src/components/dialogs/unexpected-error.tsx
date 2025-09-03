import { UnexpectedErrorDialogState } from "src/state/dialog";
import { DialogContainer, DialogHeader, SimpleDialogActions } from "../dialog";
import { Form, Formik } from "formik";
import { useTranslate } from "src/hooks/use-translate";
import { ErrorIcon } from "src/icons";

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
                    action: translate("cancel"),
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
