import { Fragment, type ReactNode } from "react";
import clsx from "clsx";
import { useTranslate } from "src/hooks/use-translate";
import {
  ChevronRightIcon,
  CloseIcon,
  ErrorIcon,
  InfoIcon,
  SuccessIcon,
  WarningIcon,
} from "src/icons";
import {
  describeIssue,
  type ImportIssue,
  type ImportOutcome,
  type ImportStats,
} from "./import-outcome";

// The order the breakdown reads in. Only the ones that happened are shown, so
// "9 added" is not padded out with zeroes.
const STATS = [
  "added",
  "updated",
  "identical",
  "ignored",
  "notModified",
] as const satisfies readonly (keyof ImportStats)[];

// Same colours and icons the notification banner uses, applied to the card
// itself rather than to a bubble inside it.
const report = {
  success: {
    background: "bg-success-subtle",
    tint: "text-success",
    Icon: SuccessIcon,
  },
  info: { background: "bg-info-subtle", tint: "text-info", Icon: InfoIcon },
  warning: {
    background: "bg-warning-subtle",
    tint: "text-warning",
    Icon: WarningIcon,
  },
  failed: {
    background: "bg-error-subtle",
    tint: "text-error",
    Icon: ErrorIcon,
  },
} as const;

export const ImportOutcomeReport = ({
  outcome,
  translationKeys,
  onDismiss,
}: {
  outcome: ImportOutcome;
  translationKeys: string;
  onDismiss: () => void;
}) => {
  const translate = useTranslate();
  const { background, tint, Icon } = report[outcome.status];

  return (
    // The dismiss sits over the whole of it: the status is carried by the
    // card's background and icon rather than by a nested bubble.
    <div
      className={clsx(
        "relative flex items-start gap-2 py-3 pl-4 pr-4 rounded-base",
        background,
      )}
    >
      <Icon className={clsx("h-4 w-4 mt-0.5 shrink-0", tint)} aria-hidden />
      <div className="flex flex-col gap-2 grow min-w-0 text-size-base">
        <OutcomeSummary outcome={outcome} translationKeys={translationKeys} />
        <OutcomeIssues outcome={outcome} translationKeys={translationKeys} />
      </div>
      <button
        className="absolute top-2.5 right-2.5 p-1 rounded-base text-subtle hover:text-default focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-accent"
        onClick={onDismiss}
        aria-label={translate("dismiss")}
        type="button"
      >
        <CloseIcon />
      </button>
    </div>
  );
};

export const ImportFileReport = ({
  fileName,
  outcome,
  translationKeys,
  onRemove,
  removeLabel,
  help,
}: {
  fileName: string;
  outcome: ImportOutcome;
  translationKeys: string;
  onRemove: () => void;
  removeLabel: string;
  help?: ReactNode;
}) => {
  const { tint, Icon } = report[outcome.status];
  const isError = outcome.status === "failed";

  return (
    <div
      className={clsx(
        "flex items-start gap-3 p-4 border rounded-base",
        isError && "bg-error-subtle border-error-line",
      )}
    >
      <Icon className={clsx("h-4 w-4 mt-0.5 shrink-0", tint)} aria-hidden />
      <div className="flex flex-col gap-2 grow min-w-0 text-size-base">
        <span className="font-semibold truncate" title={fileName}>
          {fileName}
        </span>
        <OutcomeSummary outcome={outcome} translationKeys={translationKeys} />
        <OutcomeIssues
          outcome={outcome}
          translationKeys={translationKeys}
          listClassName="max-h-40 overflow-auto"
        />
        {help}
      </div>
      <button
        className="p-1 -m-1 rounded-base text-subtle hover:text-default hover:bg-base-hover focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-accent"
        onClick={onRemove}
        aria-label={removeLabel}
        type="button"
      >
        <CloseIcon />
      </button>
    </div>
  );
};

export type IssueGroup = {
  id: number;
  title?: string;
  onSelect?: () => void;
  issues: ImportIssue[];
};

export const ImportIssuesReport = ({
  groups,
  translationKeys,
}: {
  groups: IssueGroup[];
  translationKeys: string;
}) => {
  const translate = useTranslate();
  const { background, tint, Icon } = report.warning;
  const count = groups.reduce((total, { issues }) => total + issues.length, 0);
  if (count === 0) return null;

  return (
    <div
      className={clsx(
        "flex items-start gap-2 px-3 py-2 rounded-base text-size-base",
        background,
      )}
    >
      <Icon className={clsx("h-4 w-4 mt-0.5 shrink-0", tint)} aria-hidden />
      <details className="group grow min-w-0">
        <summary className="flex items-center gap-1 cursor-pointer font-semibold list-none [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon
            className="shrink-0 transition-transform group-open:rotate-90"
            size="sm"
          />
          {translate(`${translationKeys}.issues`)}
          <span className="font-normal text-subtle">({count})</span>
        </summary>
        <div className="mt-2 flex flex-col gap-3 max-h-40 overflow-auto rounded-base border bg-popover p-3">
          {groups
            .filter(({ issues }) => issues.length > 0)
            .map((group) => (
              <section key={group.id} className="flex flex-col gap-1 min-w-0">
                {group.title !== undefined &&
                  (group.onSelect ? (
                    <button
                      type="button"
                      className="self-start max-w-full font-semibold truncate text-left hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent rounded-base"
                      onClick={group.onSelect}
                      title={group.title}
                    >
                      {group.title}
                    </button>
                  ) : (
                    <span
                      className="font-semibold truncate"
                      title={group.title}
                    >
                      {group.title}
                    </span>
                  ))}
                <ul className="list-disc pl-5 space-y-1">
                  {group.issues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>
                      {describeIssue(issue, translate, translationKeys)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </details>
    </div>
  );
};

const OutcomeSummary = ({
  outcome,
  translationKeys,
}: {
  outcome: ImportOutcome;
  translationKeys: string;
}) => {
  const translate = useTranslate();
  const stats = outcome.stats;
  const shown = stats ? STATS.filter((stat) => stats[stat] > 0) : [];
  if (!outcome.message && shown.length === 0) return null;

  return (
    <span>
      {outcome.message}
      {outcome.message && shown.length > 0 ? ": " : null}
      {stats &&
        shown.map((stat, index) => {
          const text = translate(
            `${translationKeys}.${stat}`,
            String(stats[stat]),
          );
          return (
            <Fragment key={stat}>
              {index > 0 ? ", " : null}
              {stat === "ignored" ? (
                <span className="font-semibold text-warning">{text}</span>
              ) : (
                text
              )}
            </Fragment>
          );
        })}
    </span>
  );
};

const OutcomeIssues = ({
  outcome,
  translationKeys,
  listClassName,
}: {
  outcome: ImportOutcome;
  translationKeys: string;
  listClassName?: string;
}) => {
  const translate = useTranslate();
  if (!outcome.issues || outcome.issues.length === 0) return null;

  return (
    <details className="group">
      <summary className="flex items-center gap-1 cursor-pointer font-semibold list-none [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          className="shrink-0 transition-transform group-open:rotate-90"
          size="sm"
        />
        {translate(`${translationKeys}.issues`)}
      </summary>
      <ul
        className={clsx(
          "mt-2 list-disc rounded-base border bg-popover p-3 pl-8 space-y-1",
          listClassName,
        )}
      >
        {outcome.issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`}>
            {describeIssue(issue, translate, translationKeys)}
          </li>
        ))}
      </ul>
    </details>
  );
};
