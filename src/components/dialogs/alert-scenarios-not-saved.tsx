import { DialogHeader } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Form, Formik } from "formik";
import { SimpleDialogActions } from "src/components/dialog";
import { WarningIcon } from "src/icons";

export const AlertScenariosNotSavedDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  return (
    <Formik
      onSubmit={() => {
        onClose();
        onContinue();
      }}
      initialValues={{}}
    >
      <Form>
        <DialogHeader
          title={translate("alertScenariosNotSaved")}
          titleIcon={WarningIcon}
          variant="warning"
        />
        <div className="text-sm">
          <p className="text-sm text-gray-700">
            {translate("alertScenariosNotSavedDetail")}
          </p>
        </div>
        <SimpleDialogActions action={translate("understood")} />
      </Form>
    </Formik>
  );
};
