import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { Form, Formik } from "formik";
import SimpleDialogActions from "./simple_dialog_actions";
import { SubscribeCTA } from "./InpIssues";
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
          <p className="pb-2">{translate("alertInpOutputDetail")}</p>
          <SubscribeCTA />
        </div>
        <SimpleDialogActions
          action={translate("understood")}
          secondary={{
            action: translate("cancel"),
            onClick: onClose,
          }}
        />
      </Form>
    </Formik>
  );
};
