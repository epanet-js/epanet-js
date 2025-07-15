import { CustomerPointsImportSummaryState } from "src/state/dialog";
import { DialogContainer, DialogHeader, SimpleDialogActions } from "../dialog";
import { CheckCircledIcon } from "@radix-ui/react-icons";
import { Form, Formik } from "formik";

export const CustomerPointsImportSummaryDialog = ({
  modal,
  onClose,
}: {
  modal: CustomerPointsImportSummaryState;
  onClose: () => void;
}) => {
  const { count } = modal;

  return (
    <DialogContainer size="sm">
      <DialogHeader
        title="Import Successful"
        titleIcon={CheckCircledIcon}
        variant="success"
      />
      <Formik onSubmit={() => onClose()} initialValues={{}}>
        <Form>
          <p className="text-sm text-gray">
            Successfully imported {count} customer point{count === 1 ? "" : "s"}
            .
          </p>
          <SimpleDialogActions autoFocusSubmit={true} action="OK" />
        </Form>
      </Formik>
    </DialogContainer>
  );
};
