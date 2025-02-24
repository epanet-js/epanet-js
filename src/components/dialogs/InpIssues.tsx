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
import { Button } from "../elements";
import { useState } from "react";
import { Form, Formik } from "formik";
import { newsletterUrl } from "src/global-config";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog_state";
import { ParserIssues } from "src/import/inp";
import { isFeatureOn } from "src/infra/feature-flags";

export const InpIssuesDialog = ({
  issues,
  onClose,
}: {
  issues: ParserIssues;
  onClose: () => void;
}) => {
  const setDialogState = useSetAtom(dialogAtom);

  const goToWelcome = () => {
    setDialogState({
      type: "welcome",
    });
  };
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
              secondary={{
                action: translate("seeDemoNetworks"),
                onClick: goToWelcome,
              }}
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
              <CoordinatesIssues issues={issues} />
            </div>
            <SimpleDialogActions
              autoFocusSubmit={true}
              action={translate("understood")}
              secondary={{
                action: translate("seeDemoNetworks"),
                onClick: goToWelcome,
              }}
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
            secondary={{
              action: translate("seeDemoNetworks"),
              onClick: goToWelcome,
            }}
          />
        </Form>
      </Formik>
    </>
  );
};

export const SubscribeCTA = () => {
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

const CoordinatesIssues = ({ issues }: { issues: ParserIssues }) => {
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
        {translate("issuesSummary")}{" "}
      </Button>
      {isExpaned && (
        <div className="p-2 flex flex-col gap-y-4  ml-3 mt-2 border font-mono rounded-sm text-sm bg-gray-100 text-gray-700 max-h-[300px] overflow-y-auto">
          {issues.nodesMissingCoordinates && (
            <div>
              <p>{translate("nodesMissingCoordinates")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                {Array.from(issues.nodesMissingCoordinates)
                  .slice(0, 4)
                  .map((nodeId) => (
                    <span key={nodeId}>- {nodeId}</span>
                  ))}
                {issues.nodesMissingCoordinates.size > 4 && (
                  <span>
                    {" "}
                    and {issues.nodesMissingCoordinates.size - 4} more...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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
        {translate("issuesSummary")}{" "}
      </Button>
      {isExpaned && (
        <div className="p-2 flex flex-col gap-y-4  ml-3 mt-2 border font-mono rounded-sm text-sm bg-gray-100 text-gray-700 max-h-[300px] overflow-y-auto">
          {issues.unsupportedSections && (
            <div>
              <p>{translate("useOfUnsupported")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                {Array.from(issues.unsupportedSections).map((sectionName) => (
                  <span key={sectionName}>- {sectionName}</span>
                ))}
              </div>
            </div>
          )}
          {!isFeatureOn("FLAG_JUNCTION_DEMANDS") &&
            issues.extendedPeriodSimulation && (
              <div>
                <p>{translate("nonDefaultEpanetValues", "[TIMES]")}:</p>
                <div className="flex flex-col gap-y-1 items-start">
                  {issues.extendedPeriodSimulation && (
                    <span>
                      - {translate("customValueNotSupport", "DURATION", "0")}
                    </span>
                  )}
                </div>
              </div>
            )}
          {isFeatureOn("FLAG_JUNCTION_DEMANDS") && issues.nonDefaultTimes && (
            <div>
              <p>{translate("nonDefaultEpanetValues", "[TIMES]")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                {[...issues.nonDefaultTimes.entries()].map(
                  ([name, defaultValue]) => (
                    <span key={name}>
                      -{" "}
                      {translate(
                        "customValueNotSupport",
                        name.toUpperCase(),
                        String(defaultValue),
                      )}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
          {issues.nonDefaultOptions && (
            <div>
              <p>{translate("nonDefaultEpanetValues", "[OPTIONS]")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                {[...issues.nonDefaultOptions.entries()].map(
                  ([optionName, defaultValue]) => (
                    <span key={optionName}>
                      -{" "}
                      {translate(
                        "customValueNotSupport",
                        optionName.toUpperCase(),
                        String(defaultValue),
                      )}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
          {issues.unbalancedDiff && (
            <div>
              <p>{translate("ignoredValuesDetected", "[OPTIONS]")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                <span>
                  -{" "}
                  {translate(
                    "valueIgnored",
                    "UNBALANCED",
                    issues.unbalancedDiff.defaultSetting,
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
