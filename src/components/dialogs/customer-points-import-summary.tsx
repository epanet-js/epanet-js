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
      issuesList.push(
        issues.skippedNonPointFeatures === 1
          ? translate(
              "nonPointFeatureSingular",
              localizeDecimal(issues.skippedNonPointFeatures),
            )
          : translate(
              "nonPointFeaturePlural",
              localizeDecimal(issues.skippedNonPointFeatures),
            ),
      );
    }
    if (issues?.skippedInvalidCoordinates) {
      issuesList.push(
        issues.skippedInvalidCoordinates === 1
          ? translate(
              "featureWithInvalidCoordSingular",
              localizeDecimal(issues.skippedInvalidCoordinates),
            )
          : translate(
              "featureWithInvalidCoordPlural",
              localizeDecimal(issues.skippedInvalidCoordinates),
            ),
      );
    }
    if (issues?.skippedInvalidLines) {
      issuesList.push(
        issues.skippedInvalidLines === 1
          ? translate(
              "invalidLineSingular",
              localizeDecimal(issues.skippedInvalidLines),
            )
          : translate(
              "invalidLinePlural",
              localizeDecimal(issues.skippedInvalidLines),
            ),
      );
    }
    if (issues?.skippedCreationFailures) {
      issuesList.push(
        issues.skippedCreationFailures === 1
          ? translate(
              "creationFailureSingular",
              localizeDecimal(issues.skippedCreationFailures),
            )
          : translate(
              "creationFailurePlural",
              localizeDecimal(issues.skippedCreationFailures),
            ),
      );
    }
    if (issues?.skippedNoValidJunction) {
      issuesList.push(
        issues.skippedNoValidJunction === 1
          ? translate(
              "customerPointWithoutJunctionSingular",
              localizeDecimal(issues.skippedNoValidJunction),
            )
          : translate(
              "customerPointWithoutJunctionPlural",
              localizeDecimal(issues.skippedNoValidJunction),
            ),
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
