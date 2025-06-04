import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { Form, Formik } from "formik";
import { SimpleDialogActions } from "src/components/dialog";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

export const AlertInpOutputDialog = ({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) => {
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
          title={translate("alertInpOutput")}
          titleIcon={ExclamationTriangleIcon}
          variant="warning"
        />
        <div className="text-sm">
          <p className="text-base font-semibold text-gray-700 pb-4">
            {translate("alertInpOutputSubtitle")}
          </p>
          <p className="text-sm text-gray-700">
            {translate("alertInpOutputDetail")}
          </p>
        </div>
        <SimpleDialogActions action={translate("understood")} />
      </Form>
    </Formik>
  );
};
