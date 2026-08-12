import * as Progress from "@radix-ui/react-progress";
import { ChevronRight } from "lucide-react";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { WarningIcon } from "src/icons";
import { blockingChecks } from "src/lib/network-review/blocking-checks";
import { CheckType } from "src/panels/network-review/common";
import { PreSimulationChecksDialogState } from "src/state/dialog";

const RunningBody = () => {
  const translate = useTranslate();

  return (
    <div className="p-6 flex flex-col gap-4">
      <p className="text-size-base text-subtle">
        {translate("preSimulationChecks.running")}
      </p>
      <Progress.Root
        className="relative overflow-hidden bg-track rounded-full w-full h-2"
        value={null}
      >
        <Progress.Indicator className="bg-accent h-full w-1/4 rounded-full progress-indeterminate" />
      </Progress.Root>
    </div>
  );
};

const FailingCheckRow = ({
  checkType,
  count,
  onClick,
}: {
  checkType: CheckType;
  count: number;
  onClick: () => void;
}) => {
  const translate = useTranslate();
  const label = translate(`networkReview.${checkType}.title`);

  return (
    <Button
      onClick={onClick}
      variant={"quiet/list"}
      aria-label={label}
      className="group w-full"
    >
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 items-center p-2 text-size-base w-full text-left">
        <span className="text-orange-500 dark:text-orange-400">
          <WarningIcon size={16} />
        </span>
        <div className="flex flex-col items-start">
          <span className="font-bold">{label}</span>
          <span className="text-subtle">
            {translate("preSimulationChecks.affectedCount", count)}
          </span>
        </div>
        <ChevronRight size={16} />
      </div>
    </Button>
  );
};

const SummaryBody = ({
  counts,
  onReview,
}: {
  counts: Partial<Record<CheckType, number>>;
  onReview: (check: CheckType) => void;
}) => {
  const translate = useTranslate();
  const failing = blockingChecks.filter((check) => (counts[check] ?? 0) > 0);

  return (
    <div className="p-4 text-size-base flex flex-col gap-2">
      <p>{translate("preSimulationChecks.body")}</p>
      <div className="-mx-2">
        {failing.map((check) => (
          <FailingCheckRow
            key={check}
            checkType={check}
            count={counts[check] ?? 0}
            onClick={() => onReview(check)}
          />
        ))}
      </div>
    </div>
  );
};

export const PreSimulationChecksDialog = ({
  modal,
  onClose,
}: {
  modal: PreSimulationChecksDialogState;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const { counts, onReview, onRunAnyway, onCancel } = modal;

  const closeThen = (action: () => void) => () => {
    onClose();
    action();
  };

  if (counts === undefined) {
    return (
      <BaseDialog
        title={translate("preSimulationChecks.title")}
        size="sm"
        isOpen={true}
        onClose={closeThen(onCancel)}
        footer={
          <SimpleDialogActions
            action={translate("cancel")}
            onAction={closeThen(onCancel)}
          />
        }
      >
        <RunningBody />
      </BaseDialog>
    );
  }

  return (
    <BaseDialog
      title={translate("preSimulationChecks.title")}
      size="sm"
      isOpen={true}
      onClose={closeThen(onCancel)}
      footer={
        <SimpleDialogActions
          action={translate("preSimulationChecks.review")}
          onAction={closeThen(() => onReview())}
          secondary={{
            action: translate("preSimulationChecks.runAnyway"),
            onClick: closeThen(onRunAnyway),
          }}
        />
      }
    >
      <SummaryBody
        counts={counts}
        onReview={(check) => closeThen(() => onReview(check))()}
      />
    </BaseDialog>
  );
};
