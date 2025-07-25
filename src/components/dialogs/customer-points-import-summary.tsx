import { CustomerPointsImportSummaryState } from "src/state/dialog";
import { DialogContainer, DialogHeader, SimpleDialogActions } from "../dialog";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { Form, Formik } from "formik";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";

export const CustomerPointsImportSummaryDialog = ({
  modal,
  onClose,
}: {
  modal: CustomerPointsImportSummaryState;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const { status, count, issues } = modal;

  if (status === "error") {
    return (
      <DialogContainer size="sm">
        <DialogHeader
          title={translate("importFailed")}
          titleIcon={CrossCircledIcon}
          variant="danger"
        />
        <Formik onSubmit={() => onClose()} initialValues={{}}>
          <Form>
            <p className="text-sm text-gray">
              {translate("couldNotImportCustomerPoints")}{" "}
              {count === 0
                ? translate("noValidCustomerPointsFound")
                : translate("fileFormatNotRecognized")}
            </p>
            <SimpleDialogActions
              autoFocusSubmit={true}
              action={translate("ok")}
            />
          </Form>
        </Formik>
      </DialogContainer>
    );
  }

  if (status === "warning") {
    const issuesList = [];
    if (issues?.skippedNonPointFeatures) {
      const count = issues.skippedNonPointFeatures.length;
      issuesList.push(
        count === 1
          ? translate("nonPointFeatureSingular", localizeDecimal(count))
          : translate("nonPointFeaturePlural", localizeDecimal(count)),
      );
    }
    if (issues?.skippedInvalidCoordinates) {
      const count = issues.skippedInvalidCoordinates.length;
      issuesList.push(
        count === 1
          ? translate("featureWithInvalidCoordSingular", localizeDecimal(count))
          : translate("featureWithInvalidCoordPlural", localizeDecimal(count)),
      );
    }
    if (issues?.skippedCreationFailures) {
      const count = issues.skippedCreationFailures.length;
      issuesList.push(
        count === 1
          ? translate("creationFailureSingular", localizeDecimal(count))
          : translate("creationFailurePlural", localizeDecimal(count)),
      );
    }

    return (
      <DialogContainer size="sm">
        <DialogHeader
          title={translate("importCompletedWithWarnings")}
          titleIcon={ExclamationTriangleIcon}
          variant="warning"
        />
        <Formik onSubmit={() => onClose()} initialValues={{}}>
          <Form>
            <p className="text-sm text-gray">
              {count === 1
                ? translate(
                    "importedCustomerPointSingular",
                    localizeDecimal(count),
                  )
                : translate(
                    "importedCustomerPointPlural",
                    localizeDecimal(count),
                  )}
              .
            </p>
            <p className="text-sm text-gray mt-2">
              {translate("skippedLabel", issuesList.join(", "))}
            </p>
            <SimpleDialogActions
              autoFocusSubmit={true}
              action={translate("ok")}
            />
          </Form>
        </Formik>
      </DialogContainer>
    );
  }

  return (
    <DialogContainer size="sm">
      <DialogHeader
        title={translate("importSuccessful")}
        titleIcon={CheckCircledIcon}
        variant="success"
      />
      <Formik onSubmit={() => onClose()} initialValues={{}}>
        <Form>
          <p className="text-sm text-gray">
            {count === 1
              ? translate(
                  "successfullyImportedSingular",
                  localizeDecimal(count),
                )
              : translate("successfullyImportedPlural", localizeDecimal(count))}
          </p>
          <SimpleDialogActions
            autoFocusSubmit={true}
            action={translate("ok")}
          />
        </Form>
      </Formik>
    </DialogContainer>
  );
};
