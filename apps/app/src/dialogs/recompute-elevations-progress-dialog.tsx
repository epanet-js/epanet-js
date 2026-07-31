import { useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Button } from "src/components/elements";
import { NotificationBanner } from "src/components/notifications";
import { TranslateFn, useTranslate } from "src/hooks/use-translate";
import { UnavailableIcon, WarningIcon } from "src/icons";
import type { ElevationFetchStatus } from "src/lib/elevations";
import type {
  RecomputeElevationsProgressDialogState,
  RecomputeElevationsSummary,
} from "src/state/dialog";

export const RecomputeElevationsProgressDialog = ({
  modal,
  onClose,
}: {
  modal: RecomputeElevationsProgressDialogState;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  if (modal.summary) {
    return (
      <SummaryDialog
        summary={modal.summary}
        translate={translate}
        onClose={onClose}
      />
    );
  }

  return (
    <RunningDialog
      resolved={modal.resolved}
      total={modal.total}
      status={modal.status}
      onStop={modal.onStop}
    />
  );
};

const RunningDialog = ({
  resolved = 0,
  total = 0,
  status,
  onStop,
}: {
  resolved?: number;
  total?: number;
  status?: ElevationFetchStatus;
  onStop?: () => void;
}) => {
  const translate = useTranslate();
  const [stopping, setStopping] = useState(false);
  const percent =
    total > 0 ? Math.min(100, Math.round((resolved / total) * 100)) : null;
  const statusText = describeStatus(status, translate);

  const handleStop = () => {
    setStopping(true);
    onStop?.();
  };

  return (
    <BaseDialog size="sm" isOpen={true} onClose={() => {}} preventClose={true}>
      <div className="p-6 flex flex-col gap-4">
        <div>
          <div className="flex flex-row items-baseline justify-between gap-1 mb-2">
            <p className="text-size-base text-subtle">
              {translate("elevations.recompute.running")}
            </p>
            {percent !== null && (
              <p className="text-size-base font-bold text-default tabular-nums">
                {percent}%
              </p>
            )}
          </div>
          <Progress.Root
            className="relative overflow-hidden bg-track rounded-full w-full h-2"
            value={percent}
            max={100}
          >
            {percent === null ? (
              <Progress.Indicator className="bg-accent h-full w-1/4 rounded-full progress-indeterminate" />
            ) : (
              <Progress.Indicator
                className="bg-accent w-full h-full transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${100 - percent}%)` }}
              />
            )}
          </Progress.Root>
          {statusText && (
            <p className="text-size-small text-subtle truncate mt-2">
              {statusText}
            </p>
          )}
        </div>
        {onStop && (
          <div className="flex justify-center">
            <Button
              variant="default"
              size="sm"
              disabled={stopping}
              onClick={handleStop}
            >
              {stopping
                ? translate("elevations.recompute.stopping")
                : translate("elevations.recompute.stop")}
            </Button>
          </div>
        )}
      </div>
    </BaseDialog>
  );
};

const SummaryDialog = ({
  summary,
  translate,
  onClose,
}: {
  summary: RecomputeElevationsSummary;
  translate: TranslateFn;
  onClose: () => void;
}) => {
  const banner = describeSummary(summary, translate);

  return (
    <BaseDialog
      title={banner.title}
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
      <div className="p-4 text-size-base flex flex-col gap-4">
        <NotificationBanner
          variant={banner.variant}
          Icon={banner.Icon}
          description={banner.description}
          className="border rounded-md"
        />
        <ResultSummary summary={summary} translate={translate} />
        {banner.hint && <p className="text-subtle">{banner.hint}</p>}
      </div>
    </BaseDialog>
  );
};

// The numeric outcome, kept out of the banner so the banner speaks only to why
// the run ended the way it did.
const ResultSummary = ({
  summary,
  translate,
}: {
  summary: RecomputeElevationsSummary;
  translate: TranslateFn;
}) => {
  if (summary.total === 0) return null;

  return (
    <dl className="flex flex-col gap-1 rounded-md border p-3">
      <ResultRow
        label={translate("elevations.recompute.resultUpdated")}
        value={summary.resolved}
      />
      <ResultRow
        label={translate("elevations.recompute.resultNotUpdated")}
        value={summary.unresolved}
        muted={true}
      />
    </dl>
  );
};

const ResultRow = ({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) => (
  <div
    className={`flex items-center justify-between gap-2 ${muted ? "text-subtle" : ""}`}
  >
    <dt>{label}</dt>
    <dd className="font-semibold tabular-nums">{value}</dd>
  </div>
);

const describeStatus = (
  status: ElevationFetchStatus | undefined,
  translate: TranslateFn,
): string | null => {
  if (!status) return null;
  if (status.kind === "geotiff") {
    return translate("elevations.recompute.statusGeotiff", status.fileName);
  }
  return translate(
    "elevations.recompute.statusTiles",
    String(status.completed),
    String(status.total),
  );
};

const describeSummary = (
  summary: RecomputeElevationsSummary,
  translate: TranslateFn,
): {
  variant: "warning" | "error";
  Icon: typeof WarningIcon;
  title: string;
  description: string;
  hint?: string;
} => {
  const reviewHint = translate("elevations.recompute.reviewHint");

  switch (summary.reason) {
    case "noSources":
      return {
        variant: "warning",
        Icon: UnavailableIcon,
        title: translate("elevations.recompute.noSourcesTitle"),
        description: translate("elevations.recompute.noSources"),
        hint: translate("elevations.recompute.noSourcesHint"),
      };
    case "error":
      return {
        variant: "error",
        Icon: UnavailableIcon,
        title: translate("elevations.recompute.failedTitle"),
        description: translate("elevations.recompute.failed"),
        hint: reviewHint,
      };
    case "stopped":
      return {
        variant: "warning",
        Icon: WarningIcon,
        title: translate("elevations.recompute.stoppedTitle"),
        description: translate("elevations.recompute.stopped"),
      };
    case "completed":
      if (summary.resolved === 0) {
        return {
          variant: "warning",
          Icon: UnavailableIcon,
          title: translate("elevations.recompute.noneResolvedTitle"),
          description: translate("elevations.recompute.noneResolved"),
          hint: reviewHint,
        };
      }
      return {
        variant: "warning",
        Icon: WarningIcon,
        title: translate("elevations.recompute.summaryTitle"),
        description: translate("elevations.recompute.notFullyCovered"),
      };
  }
};
