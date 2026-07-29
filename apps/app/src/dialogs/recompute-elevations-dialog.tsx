import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import * as Progress from "@radix-ui/react-progress";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Button } from "src/components/elements";
import { useFeatureLock } from "src/components/form/paywall";
import { TranslateFn, useTranslate } from "src/hooks/use-translate";
import {
  PaywallLockIcon,
  SuccessIcon,
  UnavailableIcon,
  WarningIcon,
} from "src/icons";
import { RingSpinner } from "src/components/ring-spinner";
import { NotificationBanner } from "src/components/notifications";
import {
  ElevationTargets,
  RecomputeElevationsMode,
  RecomputeElevationsResult,
  useElevationTargets,
  useRecomputeElevations,
} from "src/commands/recompute-elevations";

type Phase = "choosing" | "running" | "done";

export const RecomputeElevationsDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const { isLocked, openPaywall } = useFeatureLock("refreshElevations");
  const { recompute } = useRecomputeElevations();
  const targets = useElevationTargets(true);

  const [phase, setPhase] = useState<Phase>("choosing");
  const [mode, setMode] = useState<RecomputeElevationsMode>("missing");
  const [result, setResult] = useState<RecomputeElevationsResult | null>(null);

  // Default to the option that has something to do once the counts resolve.
  useEffect(() => {
    if (!targets) return;
    setMode(targets.missingIds.length > 0 ? "missing" : "all");
  }, [targets]);

  const selectedCount =
    mode === "missing"
      ? (targets?.missingIds.length ?? 0)
      : (targets?.allIds.length ?? 0);

  const run = useCallback(async () => {
    if (!targets) return;
    const assetIds = mode === "missing" ? targets.missingIds : targets.allIds;
    setPhase("running");
    const res = await recompute({ assetIds, mode });
    setResult(res);
    setPhase("done");
  }, [targets, mode, recompute]);

  const handleRefresh = () => {
    if (isLocked) {
      openPaywall();
      return;
    }
    void run();
  };

  return (
    <BaseDialog
      title={translate("elevations.recompute.dialogTitle")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      preventClose={phase === "running"}
      footer={
        phase === "done" ? (
          <SimpleDialogActions onClose={onClose} />
        ) : (
          <RefreshFooter
            locked={isLocked}
            isRunning={phase === "running"}
            disabled={!isLocked && (targets === null || selectedCount === 0)}
            onRefresh={handleRefresh}
            onClose={onClose}
            translate={translate}
          />
        )
      }
    >
      <div className="p-4 text-size-base">
        {phase === "running" ? (
          <RunningState translate={translate} />
        ) : phase === "done" && result ? (
          <ResultState result={result} translate={translate} />
        ) : (
          <ChoicesState
            targets={targets}
            mode={mode}
            onModeChange={setMode}
            translate={translate}
          />
        )}
      </div>
    </BaseDialog>
  );
};

const RefreshFooter = ({
  locked,
  isRunning,
  disabled,
  onRefresh,
  onClose,
  translate,
}: {
  locked: boolean;
  isRunning: boolean;
  disabled: boolean;
  onRefresh: () => void;
  onClose: () => void;
  translate: TranslateFn;
}) => (
  <footer className="flex flex-col sm:items-center sm:flex-row-reverse gap-3 px-4 py-3 border-t">
    <Button
      type="button"
      variant="primary"
      autoFocus
      disabled={isRunning || disabled}
      onClick={onRefresh}
    >
      {locked && <PaywallLockIcon size="sm" />}
      {translate("elevations.recompute.action")}
    </Button>
    <Button type="button" disabled={isRunning} onClick={onClose}>
      {translate("dialog.cancel")}
    </Button>
  </footer>
);

const ChoicesState = ({
  targets,
  mode,
  onModeChange,
  translate,
}: {
  targets: ElevationTargets | null;
  mode: RecomputeElevationsMode;
  onModeChange: (mode: RecomputeElevationsMode) => void;
  translate: TranslateFn;
}) => {
  if (targets === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-subtle">
        <RingSpinner />
        <span>{translate("loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-subtle">{translate("elevations.recompute.intro")}</p>
      <div className="flex flex-col gap-2">
        <ModeOption
          checked={mode === "missing"}
          disabled={targets.missingIds.length === 0}
          label={translate("elevations.recompute.refreshMissing")}
          count={targets.missingIds.length}
          onSelect={() => onModeChange("missing")}
        />
        <ModeOption
          checked={mode === "all"}
          disabled={targets.allIds.length === 0}
          label={translate("elevations.recompute.refreshAll")}
          count={targets.allIds.length}
          onSelect={() => onModeChange("all")}
        />
      </div>
    </div>
  );
};

const ModeOption = ({
  checked,
  disabled,
  label,
  count,
  onSelect,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  count: number;
  onSelect: () => void;
}) => (
  <label
    className={clsx(
      "flex items-center justify-between gap-3 rounded-md border p-3",
      disabled
        ? "opacity-40 cursor-not-allowed border-strong"
        : checked
          ? "border-accent bg-accent-subtle cursor-pointer"
          : "border-strong hover:bg-base-hover cursor-pointer",
    )}
  >
    <span className="flex items-center gap-2 min-w-0">
      <input
        type="radio"
        className={clsx(
          "w-4 h-4 text-accent border-strong focus:ring-0 focus:ring-offset-0",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span className="truncate">{label}</span>
    </span>
    <span className="text-subtle tabular-nums shrink-0">{count}</span>
  </label>
);

const RunningState = ({ translate }: { translate: TranslateFn }) => (
  <div className="space-y-2 py-4">
    <p className="text-size-base text-subtle">
      {translate("elevations.recompute.running")}
    </p>
    <Progress.Root
      className="relative overflow-hidden bg-track rounded-full w-full h-2"
      value={null}
    >
      <Progress.Indicator className="bg-accent h-full w-1/4 rounded-full progress-indeterminate" />
    </Progress.Root>
  </div>
);

const ResultState = ({
  result,
  translate,
}: {
  result: RecomputeElevationsResult;
  translate: TranslateFn;
}) => {
  const { variant, Icon, title, description, hint } = describeResult(
    result,
    translate,
  );

  return (
    <div className="space-y-3">
      <NotificationBanner
        variant={variant}
        Icon={Icon}
        title={title}
        description={description}
        className="border rounded-md"
      />
      {hint && <p className="whitespace-pre-line">{hint}</p>}
    </div>
  );
};

const describeResult = (
  result: RecomputeElevationsResult,
  translate: TranslateFn,
): {
  Icon: typeof SuccessIcon;
  variant: "success" | "warning" | "error";
  title: string;
  description: string;
  hint?: string;
} => {
  if (result.status === "noSources") {
    return {
      Icon: WarningIcon,
      variant: "warning",
      title: translate("elevations.recompute.noSourcesTitle"),
      description: translate("elevations.recompute.noSources"),
    };
  }

  if (result.status === "error") {
    return {
      Icon: UnavailableIcon,
      variant: "error",
      title: translate("elevations.recompute.failedTitle"),
      description: translate("elevations.recompute.failed"),
    };
  }

  if (result.resolved === 0) {
    return {
      Icon: WarningIcon,
      variant: "warning",
      title: translate("elevations.recompute.noneResolvedTitle"),
      description: translate(
        "elevations.recompute.noneResolved",
        String(result.total),
      ),
    };
  }

  if (result.unresolved > 0) {
    return {
      Icon: WarningIcon,
      variant: "warning",
      title: translate("elevations.recompute.summaryTitle"),
      description: translate(
        "elevations.recompute.summary",
        String(result.resolved),
        String(result.unresolved),
      ),
      hint: translate("elevations.recompute.reviewHint"),
    };
  }

  return {
    Icon: SuccessIcon,
    variant: "success",
    title: translate("elevations.recompute.summaryTitle"),
    description: translate(
      "elevations.recompute.summaryAllResolved",
      String(result.resolved),
    ),
  };
};
