import { Fragment, useCallback, useState, type ReactNode } from "react";
import clsx from "clsx";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useTranslate } from "src/hooks/use-translate";
import { Button, DDContent, StyledItem } from "src/components/elements";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  ErrorIcon,
  InfoIcon,
  SuccessIcon,
  WarningIcon,
} from "src/icons";
import { captureError } from "src/infra/error-tracking";

export type ImportOutcome = {
  status: "success" | "info" | "warning" | "failed";
  // The one-liner shown in the notification. Omitted when there is nothing
  // to call out — a clean import just shows its summary.
  message?: string;
  // Regular-weight sentences shown underneath it.
  notes?: ReactNode[];
  // Collapsed by default: how many entries were ignored, and why.
  issues?: { summary: ReactNode; lines: string[] };
};

// Same colours and icons the notification banner uses, applied to the strip
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

export const ImportExportToolbar = ({
  onExportCsv,
  onExportXlsx,
  onImport,
  onImportingChange,
  readOnly = false,
}: {
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onImport: () => Promise<ImportOutcome | null>;
  onImportingChange?: (isImporting: boolean) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [isImporting, setImporting] = useState(false);

  const setBusy = useCallback(
    (isBusy: boolean) => {
      setImporting(isBusy);
      onImportingChange?.(isBusy);
    },
    [onImportingChange],
  );

  const handleImport = useCallback(() => {
    setBusy(true);
    void onImport()
      .then(setOutcome)
      .catch((error: Error) => {
        captureError(error);
        setOutcome({
          status: "failed",
          message: translate("fileReadError"),
        });
      })
      .finally(() => setBusy(false));
  }, [onImport, setBusy, translate]);

  if (outcome) {
    return (
      <ImportOutcomeReport
        outcome={outcome}
        onDismiss={() => setOutcome(null)}
      />
    );
  }

  return (
    <div className="flex items-center px-4 py-2 border-b h-12">
      <div className="flex items-center gap-2 ml-auto">
        <DD.Root>
          <DD.Trigger asChild>
            <Button variant="default" size="sm" disabled={isImporting}>
              {translate("export")}
              <ChevronDownIcon />
            </Button>
          </DD.Trigger>
          <DDContent align="end">
            <StyledItem onSelect={onExportCsv}>
              {translate("exportCsv")}
            </StyledItem>
            <StyledItem onSelect={onExportXlsx}>
              {translate("exportXlsx")}
            </StyledItem>
          </DDContent>
        </DD.Root>
        <Button
          variant="default"
          size="sm"
          onClick={handleImport}
          disabled={readOnly || isImporting}
        >
          {translate("import")}
        </Button>
      </div>
    </div>
  );
};

const ImportOutcomeReport = ({
  outcome,
  onDismiss,
}: {
  outcome: ImportOutcome;
  onDismiss: () => void;
}) => {
  const translate = useTranslate();
  const { background, tint, Icon } = report[outcome.status];

  return (
    // The dismiss sits over the whole report, which is one strip: the status
    // is carried by its background and icon rather than by a nested bubble.
    <div
      className={clsx(
        "relative flex items-start gap-2 min-h-12 py-3.5 pl-4 pr-10 border-b",
        background,
      )}
    >
      <Icon className={clsx("h-4 w-4 mt-0.5 shrink-0", tint)} aria-hidden />
      <div className="flex flex-col gap-2 grow min-w-0 text-size-base">
        {(outcome.message || outcome.notes?.length) && (
          <span>
            {outcome.message}
            {outcome.message && outcome.notes?.length ? ": " : null}
            {outcome.notes?.map((note, index) => (
              <Fragment key={index}>
                {index > 0 ? " " : null}
                {note}
              </Fragment>
            ))}
          </span>
        )}
        {outcome.issues && (
          <details className="group">
            <summary className="flex items-center gap-1 cursor-pointer font-semibold list-none [&::-webkit-details-marker]:hidden">
              <ChevronRightIcon
                className="shrink-0 transition-transform group-open:rotate-90"
                size="sm"
              />
              {outcome.issues.summary}
            </summary>
            <ul className="mt-2 list-disc rounded-md border bg-popover p-3 pl-8 space-y-1">
              {outcome.issues.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <button
        className="absolute top-3 right-3 p-1 rounded-md text-subtle hover:text-default focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-accent"
        onClick={onDismiss}
        aria-label={translate("dismiss")}
        type="button"
      >
        <CloseIcon />
      </button>
    </div>
  );
};
