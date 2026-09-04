import { useMemo, useState } from "react";
import type { Issue } from "@epanet-js/converters";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Button } from "src/components/elements";
import { ChevronDownIcon, ChevronRightIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { groupIssues, type IssueGroup } from "src/lib/converters";

const initialRefsShown = 3;

const issuesBoxClasses =
  "p-2 flex flex-col gap-y-4 ml-3 mt-2 border font-mono rounded-xs text-size-base bg-panel text-default max-h-75 overflow-y-auto";

export const ConvertModelFailedDialog = ({
  issues,
  onClose,
}: {
  issues: Issue[];
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const groups = useMemo(() => groupIssues(issues), [issues]);

  return (
    <BaseDialog
      title={translate("convertModel.failedTitle")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={onClose}
          autoFocusSubmit={true}
        />
      }
    >
      <div className="p-4 text-size-base">
        <p className="pb-2">{translate("convertModel.failedDetail")}</p>
        <div className={issuesBoxClasses}>
          {groups.map((group) => (
            <IssueGroupSummary key={group.code} group={group} />
          ))}
        </div>
      </div>
    </BaseDialog>
  );
};

export const ConvertModelIssuesDialog = ({
  issues,
  onClose,
}: {
  issues: Issue[];
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const [isExpanded, setExpanded] = useState(false);
  const groups = useMemo(() => groupIssues(issues), [issues]);

  return (
    <BaseDialog
      title={translate("convertModel.issuesTitle")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("understood")}
          onAction={onClose}
        />
      }
    >
      <div className="p-4 text-size-base">
        <p className="pb-2">{translate("convertModel.issuesDetail")}</p>
        <div className="pb-2">
          <Button
            variant="quiet"
            onClick={(e) => {
              e.preventDefault();
              if (!isExpanded) {
                userTracking.capture({ name: "convertModelIssues.expanded" });
              }
              setExpanded(!isExpanded);
            }}
            className="cursor-pointer text-md inline-flex items-center"
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
            {translate("convertModel.issuesSummary")}
          </Button>
          {isExpanded && (
            <div className={issuesBoxClasses}>
              {groups.map((group) => (
                <IssueGroupSummary key={group.code} group={group} />
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseDialog>
  );
};

const IssueGroupSummary = ({ group }: { group: IssueGroup }) => {
  const translate = useTranslate();
  const [showAll, setShowAll] = useState(false);
  const key = `convertModel.issue.${group.code}`;

  if (!group.refs.length) return <p>{translate(key, ...group.context)}</p>;

  const visible = showAll ? group.refs : group.refs.slice(0, initialRefsShown);
  const remaining = group.refs.length - initialRefsShown;

  return (
    <div>
      <p>{translate(key, group.count)}:</p>
      <div className="flex flex-col gap-y-0.5 items-start">
        {visible.map(({ ref, context }) => (
          <span key={ref}>
            - {ref}
            {context.length > 0 && ` (${context.join(", ")})`}
          </span>
        ))}
        {!showAll && remaining > 0 && (
          <Button
            variant="quiet"
            className="text-size-small text-subtle cursor-pointer self-start"
            onClick={(e) => {
              e.preventDefault();
              setShowAll(true);
            }}
          >
            {translate("andXMore", String(remaining))}
          </Button>
        )}
      </div>
    </div>
  );
};
