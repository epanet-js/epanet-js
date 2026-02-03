import { DialogHeader } from "src/components/dialog";
import { Form, Formik } from "formik";
import { SimpleDialogActions } from "src/components/dialog";
import { useShowWelcome } from "src/commands/show-welcome";
import { useTranslate } from "src/hooks/use-translate";
import { WarningIcon } from "src/icons";

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
    <Formik onSubmit={handleChooseNetwork} initialValues={{}}>
      <Form>
        <DialogHeader
          title={translate("alertNetworkRequired")}
          titleIcon={WarningIcon}
          variant="warning"
        />
        <div className="text-sm">
          <p className="text-sm text-gray-700">
            {translate("alertNetworkRequiredDetail")}
          </p>
        </div>
        <SimpleDialogActions
          action={translate("chooseANetwork")}
          onClose={onClose}
        />
      </Form>
    </Formik>
  );
};
