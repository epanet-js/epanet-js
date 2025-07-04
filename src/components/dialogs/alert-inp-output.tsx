import { DialogHeader } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
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
