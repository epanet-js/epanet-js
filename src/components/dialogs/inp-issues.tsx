import { DialogHeader } from "../dialog";
import { useTranslate } from "src/hooks/use-translate";
import {
  SimpleDialogActions,
  SimpleDialogButtons,
} from "src/components/dialog";
import { Trans } from "react-i18next";

import { Button } from "../elements";
import { useState } from "react";
import { Form, Formik } from "formik";
import { newsletterUrl, projectionConverterUrl } from "src/global-config";
import { ParserIssues } from "src/import/inp";
import { useShowWelcome } from "src/commands/show-welcome";
import { useUserTracking } from "src/infra/user-tracking";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeIcon,
  ErrorIcon,
  WarningIcon,
  SubscribeIcon,
} from "src/icons";

export const GeocodingNotSupportedDialog = ({
  onClose: _onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const showWelcome = useShowWelcome();
  const userTracking = useUserTracking();

  const goToWelcome = () => {
    showWelcome({ source: "geocodeError" });
  };

  const handleReprojectNetwork = () => {
    userTracking.capture({
      name: "projectionConverter.visited",
    });
    window.open(projectionConverterUrl);
  };
  return (
    <>
      <DialogHeader
        title={translate("geocodingNotSupported")}
        titleIcon={WarningIcon}
        variant="warning"
      />
      <div className="text-sm">
        <p className="pb-4">
          <Trans
            i18nKey="geocodingNotSupportedDetail"
            components={{
              converterLink: (
                <a
                  href={projectionConverterUrl}
                  target="_blank"
                  className="text-purple-700 dark:text-purple-300 underline"
                  onClick={(e) => {
                    e.preventDefault();
                    handleReprojectNetwork();
                  }}
                />
              ),
            }}
          />
        </p>
      </div>
      <SimpleDialogButtons>
        <Button
          type="button"
          variant="primary"
          autoFocus={true}
          onClick={handleReprojectNetwork}
        >
          {translate("reprojectNetwork")}
        </Button>
        <Button type="button" variant="default" onClick={goToWelcome}>
          {translate("seeDemoNetworks")}
        </Button>
      </SimpleDialogButtons>
    </>
  );
};

export const MissingCoordinatesDialog = ({
  issues,
  onClose,
}: {
  issues: ParserIssues;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const showWelcome = useShowWelcome();

  const goToWelcome = () => {
    showWelcome({ source: "missingCoordinatesError" });
  };
  return (
    <>
      <DialogHeader
        title={translate("missingCoordinates")}
        titleIcon={ErrorIcon}
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
};

export const InpIssuesDialog = ({
  issues,
  onClose,
}: {
  issues: ParserIssues;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const showWelcome = useShowWelcome();

  const goToWelcome = () => {
    showWelcome({ source: "inpIssues" });
  };
  return (
    <>
      <DialogHeader
        title={translate("inpNotFullySupported")}
        titleIcon={WarningIcon}
        variant="warning"
      />
      <Formik onSubmit={() => onClose()} initialValues={{}}>
        <Form>
          <div className="text-sm">
            <p className="pb-2">{translate("inpNotFullySupportedDetail")}</p>
            <IssuesSummary issues={issues} />
            <SubscribeCTA source="inpIssues" />
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

export const ProjectionCTA = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  return (
    <>
      <p className="pb-3">{translate("checkoutProjectionTool")}</p>
      <p className="text-purple-800">
        <Button
          variant="quiet"
          className="text-purple-500 font-semibold"
          onClick={(e) => {
            e.preventDefault();
            userTracking.capture({
              name: "projectionConverter.visited",
            });
            window.open(projectionConverterUrl);
          }}
        >
          <GlobeIcon />
          EPANET Projection Converter
        </Button>
      </p>
    </>
  );
};

export const SubscribeCTA = ({
  source,
}: {
  source: "geocodeError" | "inpIssues";
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  return (
    <>
      <p className="pb-3">{translate("newFeaturesEveryDay")}</p>
      <p className="text-purple-800">
        <Button
          variant="quiet"
          onClick={(e) => {
            e.preventDefault();
            userTracking.capture({
              name: "subscription.started",
              source,
            });
            window.open(newsletterUrl);
          }}
        >
          <SubscribeIcon />
          {translate("subscribeForUpdates")}
        </Button>
      </p>
    </>
  );
};

const CoordinatesIssues = ({ issues }: { issues: ParserIssues }) => {
  const translate = useTranslate();
  const maxDisplayed = 4;
  const [isExpaned, setExpanded] = useState(false);
  const userTracking = useUserTracking();
  return (
    <div className="pb-4">
      <Button
        variant="quiet"
        onClick={(e) => {
          e.preventDefault();
          if (!isExpaned) {
            userTracking.capture({
              name: "coordinatesIssues.expanded",
            });
          }
          setExpanded(!isExpaned);
        }}
        className="cursor-pointer text-md inline-flex items-center"
      >
        {isExpaned ? <ChevronDownIcon /> : <ChevronRightIcon />}
        {translate("issuesSummary")}{" "}
      </Button>
      {isExpaned && (
        <div className="p-2 flex flex-col gap-y-4  ml-3 mt-2 border font-mono rounded-sm text-sm bg-gray-100 text-gray-700 max-h-[300px] overflow-y-auto">
          {issues.nodesMissingCoordinates && (
            <div>
              <p>{translate("nodesMissingCoordinates")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                {Array.from(issues.nodesMissingCoordinates)
                  .slice(0, maxDisplayed)
                  .map((nodeId) => (
                    <span key={nodeId}>- {nodeId}</span>
                  ))}
                {issues.nodesMissingCoordinates.size > maxDisplayed && (
                  <span>
                    {" "}
                    {translate(
                      "andXMore",
                      String(
                        issues.nodesMissingCoordinates.size - maxDisplayed,
                      ),
                    )}
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
  const translate = useTranslate();
  const [isExpaned, setExpanded] = useState(false);
  const userTracking = useUserTracking();

  return (
    <div className="pb-4">
      <Button
        variant="quiet"
        onClick={(e) => {
          e.preventDefault();
          if (!isExpaned) {
            userTracking.capture({
              name: "inpIssues.expanded",
            });
          }
          setExpanded(!isExpaned);
        }}
        className="cursor-pointer text-md inline-flex items-center"
      >
        {isExpaned ? <ChevronDownIcon /> : <ChevronRightIcon />}
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
          {issues.nonDefaultTimes && (
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
          {issues.gpvValves && (
            <div>
              <p>{translate("ignoredValuesDetected", "[VALVES]")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                <span>- {translate("valueIgnored", "GPV", "TCV")}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
