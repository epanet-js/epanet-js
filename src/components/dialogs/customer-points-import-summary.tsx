import { CustomerPointsImportSummaryState } from "src/state/dialog";
import { DialogContainer, DialogHeader, SimpleDialogActions } from "../dialog";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { Form, Formik } from "formik";

export const CustomerPointsImportSummaryDialog = ({
  modal,
  onClose,
}: {
  modal: CustomerPointsImportSummaryState;
  onClose: () => void;
}) => {
  const { status, count, issues } = modal;

  if (status === "error") {
    return (
      <DialogContainer size="sm">
        <DialogHeader
          title="Import Failed"
          titleIcon={CrossCircledIcon}
          variant="danger"
        />
        <Formik onSubmit={() => onClose()} initialValues={{}}>
          <Form>
            <p className="text-sm text-gray">
              Could not import customer points.{" "}
              {count === 0
                ? "No valid customer points found in the file."
                : "File format not recognized."}
            </p>
            <SimpleDialogActions autoFocusSubmit={true} action="OK" />
          </Form>
        </Formik>
      </DialogContainer>
    );
  }

  if (status === "warning") {
    const issuesList = [];
    if (issues?.skippedNonPointFeatures) {
      issuesList.push(
        `${issues.skippedNonPointFeatures} non-point feature${issues.skippedNonPointFeatures === 1 ? "" : "s"}`,
      );
    }
    if (issues?.skippedInvalidCoordinates) {
      issuesList.push(
        `${issues.skippedInvalidCoordinates} feature${issues.skippedInvalidCoordinates === 1 ? "" : "s"} with invalid coordinates`,
      );
    }
    if (issues?.skippedInvalidLines) {
      issuesList.push(
        `${issues.skippedInvalidLines} invalid line${issues.skippedInvalidLines === 1 ? "" : "s"}`,
      );
    }
    if (issues?.skippedCreationFailures) {
      issuesList.push(
        `${issues.skippedCreationFailures} creation failure${issues.skippedCreationFailures === 1 ? "" : "s"}`,
      );
    }

    return (
      <DialogContainer size="sm">
        <DialogHeader
          title="Import Completed with Warnings"
          titleIcon={ExclamationTriangleIcon}
          variant="warning"
        />
        <Formik onSubmit={() => onClose()} initialValues={{}}>
          <Form>
            <p className="text-sm text-gray">
              Imported {count} customer point{count === 1 ? "" : "s"}.
            </p>
            <p className="text-sm text-gray mt-2">
              Skipped: {issuesList.join(", ")}.
            </p>
            <SimpleDialogActions autoFocusSubmit={true} action="OK" />
          </Form>
        </Formik>
      </DialogContainer>
    );
  }

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
