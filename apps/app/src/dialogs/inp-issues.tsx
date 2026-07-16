import { BaseDialog, SimpleDialogActions } from "../components/dialog";
import { useTranslate } from "src/hooks/use-translate";

import { Button } from "../components/elements";
import { useState } from "react";
import { newsletterUrl } from "src/global-config";
import { ParserIssues } from "src/import/inp";
import { useShowWelcome } from "src/commands/show-welcome";
import { useUserTracking } from "src/infra/user-tracking";

import { ChevronDownIcon, ChevronRightIcon, SubscribeIcon } from "src/icons";

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
      <div className="p-4 text-size-base">
        <p className="pb-2">{translate("missingCoordinatesDetail")}</p>
        <CoordinatesIssues
          sections={[
            {
              labelKey: "nodesMissingCoordinates",
              ids: issues.nodesMissingCoordinates,
            },
          ]}
        />
      </div>
    </BaseDialog>
  );
};

export const MalformedCoordinatesDialog = ({
  issues,
  onClose,
}: {
  issues: ParserIssues;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const showWelcome = useShowWelcome();

  const goToWelcome = () => {
    showWelcome({ source: "malformedCoordinatesError" });
  };
  return (
    <BaseDialog
      title={translate("malformedCoordinates")}
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
      <div className="p-4 text-size-base">
        <p className="pb-2">{translate("malformedCoordinatesDetail")}</p>
        <CoordinatesIssues
          sections={[
            {
              labelKey: "nodesMalformedCoordinates",
              ids: issues.malformedCoordinates,
            },
            {
              labelKey: "linksMalformedVertices",
              ids: issues.malformedVertices,
            },
          ]}
        />
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
      <div className="p-4 text-size-base">
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

const maxDisplayed = 4;

const IdList = ({ labelKey, ids }: { labelKey: string; ids: Set<string> }) => {
  const translate = useTranslate();
  return (
    <div>
      <p>{translate(labelKey)}:</p>
      <div className="flex flex-col gap-y-1 items-start">
        {Array.from(ids)
          .slice(0, maxDisplayed)
          .map((id) => (
            <span key={id}>- {id}</span>
          ))}
        {ids.size > maxDisplayed && (
          <span> {translate("andXMore", String(ids.size - maxDisplayed))}</span>
        )}
      </div>
    </div>
  );
};

const CoordinatesIssues = ({
  sections,
}: {
  sections: { labelKey: string; ids?: Set<string> }[];
}) => {
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
        <div className="p-2 flex flex-col gap-y-4 ml-3 mt-2 border font-mono rounded-xs text-size-base bg-panel text-default max-h-75 overflow-y-auto">
          {sections.map(
            ({ labelKey, ids }) =>
              ids && <IdList key={labelKey} labelKey={labelKey} ids={ids} />,
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
        <div className="p-2 flex flex-col gap-y-4 ml-3 mt-2 border font-mono rounded-xs text-size-base bg-panel text-default max-h-75 overflow-y-auto">
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
          {issues.invalidValveKinds && issues.invalidValveKinds.size > 0 && (
            <div>
              <p>{translate("ignoredValuesDetected", "[VALVES]")}:</p>
              <div className="flex flex-col gap-y-1 items-start">
                <span>
                  -{" "}
                  {translate(
                    "invalidValveKinds",
                    String(issues.invalidValveKinds.size),
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
