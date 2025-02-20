import { DialogHeader } from "../dialog";
import { translate } from "src/infra/i18n";
import SimpleDialogActions from "./simple_dialog_actions";
import {
  BellIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  TriangleDownIcon,
  TriangleRightIcon,
} from "@radix-ui/react-icons";
import { ParserIssues } from "src/import/parse-inp";
import { Button } from "../elements";
import { useState } from "react";
import { Form, Formik } from "formik";
import { newsletterUrl } from "src/global-config";

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
        <Button
          variant="quiet"
          onClick={(e) => {
            e.preventDefault();
            window.open(newsletterUrl);
          }}
        >
          <BellIcon />
          {translate("subscribeForUpdates")}
        </Button>
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
        <div className="p-2 flex flex-col gap-y-4  ml-3 mt-2 border font-mono rounded-sm text-sm bg-gray-100 text-gray-700">
          {issues.unsupportedSections && (
            <div>
              <p>Use of unsupported sections:</p>
              <div className="flex flex-col gap-y-1 items-start">
                {Array.from(issues.unsupportedSections).map((sectionName) => (
                  <span key={sectionName}>- [{sectionName.toUpperCase()}]</span>
                ))}
              </div>
            </div>
          )}
          {issues.extendedPeriodSimulation && (
            <div>
              <p>Non-default epanet [TIMES] values detected:</p>
              <div className="flex flex-col gap-y-1 items-start">
                {issues.extendedPeriodSimulation && (
                  <span>- Custom DURATION not supported (using 0)</span>
                )}
              </div>
            </div>
          )}
          {issues.nonDefaultOptions && (
            <div>
              <p>Non-default epanet [OPTIONS] values detected:</p>
              <div className="flex flex-col gap-y-1 items-start">
                {[...issues.nonDefaultOptions.entries()].map(
                  ([optionName, defaultValue]) => (
                    <span key={optionName}>
                      - {optionName.toUpperCase()} (using {defaultValue})
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
          {issues.unbalancedDiff && (
            <div>
              <p>Ignored [OPTIONS] values detected:</p>
              <div className="flex flex-col gap-y-1 items-start">
                <span>- UNBALANCED value is ignored (using CONTINUE 10)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
