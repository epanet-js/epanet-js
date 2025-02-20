import { DialogHeader } from "../dialog";
import { translate } from "src/infra/i18n";
import SimpleDialogActions from "./simple_dialog_actions";
import {
  BellIcon,
  CrossCircledIcon,
  DotFilledIcon,
  ExclamationTriangleIcon,
  TriangleDownIcon,
  TriangleRightIcon,
} from "@radix-ui/react-icons";
import { ParserIssues } from "src/import/parse-inp";
import { Button } from "../elements";
import { useState } from "react";
import { Form, Formik } from "formik";

export const InpIssuesDialog = ({
  issues,
  onClose,
}: {
  issues: ParserIssues;
  onClose: () => void;
}) => {
  if (issues.invalidVertices || issues.invalidCoordinates) {
    return (
      <>
        <DialogHeader
          title={translate("geocodingNotSupported")}
          titleIcon={CrossCircledIcon}
          variant="danger"
        />
        <Formik onSubmit={() => onClose()} initialValues={{}}>
          <Form>
            <div className="text-sm">
              <p className="pb-4">{translate("geocodingNotSupportedDetail")}</p>
              <SubscribeCTA />
            </div>
            <SimpleDialogActions
              autoFocusSubmit={true}
              action={translate("understood")}
            />
          </Form>
        </Formik>
      </>
    );
  }
  if (issues.nodesMissingCoordinates) {
    return (
      <>
        <DialogHeader
          title={translate("missingCoordinates")}
          titleIcon={CrossCircledIcon}
          variant="danger"
        />
        <Formik onSubmit={() => onClose()} initialValues={{}}>
          <Form>
            <div className="text-sm">
              <p className="pb-2">{translate("missingCoordinatesDetail")}</p>
            </div>
            <SimpleDialogActions
              autoFocusSubmit={true}
              action={translate("understood")}
            />
          </Form>
        </Formik>
      </>
    );
  }
  return (
    <>
      <DialogHeader
        title={translate("inpNotFullySupported")}
        titleIcon={ExclamationTriangleIcon}
        variant="warning"
      />
      <Formik onSubmit={() => onClose()} initialValues={{}}>
        <Form>
          <div className="text-sm">
            <p className="pb-2">{translate("inpNotFullySupportedDetail")}</p>
            <IssuesSummary issues={issues} />
            <SubscribeCTA />
          </div>

          <SimpleDialogActions
            autoFocusSubmit={true}
            action={translate("understood")}
          />
        </Form>
      </Formik>
    </>
  );
};

const SubscribeCTA = () => {
  return (
    <>
      <p className="pb-3">{translate("newFeaturesEveryDay")}</p>
      <p className="text-purple-800">
        <a href="" target="_blank">
          <Button variant="quiet">
            <BellIcon />
            {translate("subscribeForUpdates")}
          </Button>
        </a>
      </p>
    </>
  );
};

const IssuesSummary = ({ issues }: { issues: ParserIssues }) => {
  const [isExpaned, setExpanded] = useState(false);
  return (
    <div className="pb-4">
      <Button
        variant="quiet"
        onClick={(e) => {
          e.preventDefault();
          setExpanded(!isExpaned);
        }}
        className="cursor-pointer text-md inline-flex items-center"
      >
        {isExpaned ? <TriangleDownIcon /> : <TriangleRightIcon />}
        Issues summary{" "}
      </Button>
      {isExpaned && (
        <div className="p-1  ml-3 mt-2 border rounded-sm text-sm bg-gray-100 text-gray-700 font-mono leading-loose">
          {issues.invalidCoordinates && (
            <IssueText variant="error">
              Assets with invalid coordinates.
            </IssueText>
          )}
          {issues.invalidVertices && (
            <IssueText variant="error">Links with invalid vertices</IssueText>
          )}
          {issues.nodesMissingCoordinates && (
            <IssueText variant="error">
              Assets with missing coordinates.
            </IssueText>
          )}
          {issues.unsupportedSections && (
            <IssueText variant="warning">
              Use of unsupported sections.
            </IssueText>
          )}
          {issues.extendedPeriodSimulation && (
            <IssueText variant="warning">
              Custom duration not supported (using 0).
            </IssueText>
          )}
          {issues.patternStartNotInZero && (
            <IssueText variant="warning">
              Custom pattern start not supported (using 00:00).
            </IssueText>
          )}
          {issues.nonDefaultOptions && (
            <IssueText variant="warning">
              Non default epanet options detected.
            </IssueText>
          )}
          {issues.accuracyDiff && (
            <IssueText variant="warning">
              Custom ACCURACY not supported (using 0.001).
            </IssueText>
          )}
          {issues.unbalancedDiff && (
            <IssueText variant="warning">
              Custom UNBALANCED not supported (using CONTINUE 10).
            </IssueText>
          )}
        </div>
      )}
    </div>
  );
};

const IssueText = ({
  variant,
  children,
}: {
  variant: "error" | "warning";
  children: React.ReactNode;
}) => (
  <p className="inline-flex items-center">
    <DotFilledIcon
      className={`mr-1 ${variant === "error" ? "text-red-500" : "text-yellow-500"}`}
    />
    {children}
  </p>
);
