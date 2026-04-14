import { BaseDialog, SimpleDialogActions } from "../components/dialog";
import { useTranslate } from "src/hooks/use-translate";

import { Button } from "../components/elements";
import { useState } from "react";
import { newsletterUrl } from "src/global-config";
import { ParserIssues } from "src/import/inp";
import { useShowWelcome } from "src/commands/show-welcome";
import { useUserTracking } from "src/infra/user-tracking";

import { ChevronDownIcon, ChevronRightIcon, SubscribeIcon } from "src/icons";

const roadmapUrls = {
  waterQuality:
    "https://roadmap.epanetjs.com/simulation-engine/p/standard-water-quality-analysis",
} as const;

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
    <BaseDialog
      title={translate("missingCoordinates")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={onClose}
          autoFocusSubmit={true}
          secondary={{
            action: translate("seeDemoNetworks"),
            onClick: goToWelcome,
          }}
        />
      }
    >
      <div className="p-4 text-sm">
        <p className="pb-2">{translate("missingCoordinatesDetail")}</p>
        <CoordinatesIssues issues={issues} />
      </div>
    </BaseDialog>
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
    <BaseDialog
      title={translate("inpNotFullySupported")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={onClose}
          secondary={{
            action: translate("seeDemoNetworks"),
            onClick: goToWelcome,
          }}
        />
      }
    >
      <div className="p-4 text-sm">
        <p className="pb-2">{translate("inpNotFullySupportedDetail")}</p>
        <IssuesSummary issues={issues} />
        <SubscribeCTA source="inpIssues" />
      </div>
    </BaseDialog>
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

const RoadmapLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="hover:underline text-purple-700 dark:text-purple-300"
  >
    {children}
  </a>
);

const IssuesSummary = ({ issues }: { issues: ParserIssues }) => {
  const translate = useTranslate();
  const [isExpaned, setExpanded] = useState(false);
  const userTracking = useUserTracking();

  const waterQualityLabel =
    issues.waterQualityType === "age"
      ? translate("waterQualityAge")
      : issues.waterQualityType === "trace"
        ? translate("waterQualityTrace")
        : translate("waterQualityChemical");

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
        <div className="p-2 flex flex-col gap-y-4  ml-3 mt-2 border font-mono rounded-sm text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 max-h-[300px] overflow-y-auto">
          {issues.waterQualityType && (
            <div>
              <p>{translate("waterQualitySimulation")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                <RoadmapLink href={roadmapUrls.waterQuality}>
                  - {waterQualityLabel}
                </RoadmapLink>
              </div>
            </div>
          )}
          {issues.unsupportedSections && (
            <div>
              <p>{translate("useOfUnsupported")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                {issues.unsupportedSections &&
                  Array.from(issues.unsupportedSections).map((sectionName) => (
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
          {issues.hasUndefinedPumpCurve && (
            <div>
              <p>{translate("ignoredValuesDetected", "[PUMPS]")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                <span>
                  -{" "}
                  {translate(
                    "undefinedPumpCurves",
                    String(issues.hasUndefinedPumpCurve),
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
