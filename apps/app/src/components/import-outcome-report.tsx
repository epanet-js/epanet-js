import { Fragment } from "react";
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
  const stats = outcome.stats;
  const shown = stats ? STATS.filter((stat) => stats[stat] > 0) : [];

  return (
    // The report is a card sitting inside the panel, inset from its edges.
    // The dismiss sits over the whole of it: the status is carried by the
    // card's background and icon rather than by a nested bubble.
    <div className="p-3 pl-0">
      <div
        className={clsx(
          "relative flex items-start gap-2 py-3 pl-4 pr-4 rounded-md",
          background,
        )}
      >
        <Icon className={clsx("h-4 w-4 mt-0.5 shrink-0", tint)} aria-hidden />
        <div className="flex flex-col gap-2 grow min-w-0 text-size-base">
          {(outcome.message || shown.length > 0) && (
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
                        <span className="font-semibold text-warning">
                          {text}
                        </span>
                      ) : (
                        text
                      )}
                    </Fragment>
                  );
                })}
            </span>
          )}
          {outcome.issues && outcome.issues.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-1 cursor-pointer font-semibold list-none [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon
                  className="shrink-0 transition-transform group-open:rotate-90"
                  size="sm"
                />
                {translate(`${translationKeys}.issues`)}
              </summary>
              <ul className="mt-2 list-disc rounded-md border bg-popover p-3 pl-8 space-y-1">
                {outcome.issues.map((issue) => (
                  <li key={issue.code}>
                    {describeIssue(issue, translate, translationKeys)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <button
          className="absolute top-2.5 right-2.5 p-1 rounded-md text-subtle hover:text-default focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-accent"
          onClick={onDismiss}
          aria-label={translate("dismiss")}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};
