import * as Progress from "@radix-ui/react-progress";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { NotificationBanner } from "src/components/notifications";
import { ErrorIcon, WarningIcon } from "src/icons";
import { ruleLabelKey } from "src/panels/network-review/rule-labels";
import { PreSimulationChecksDialogState } from "src/state/dialog";

const MAX_LISTED_RULES = 3;

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

const FailedBody = () => {
  const translate = useTranslate();

  return (
    <div className="p-4 text-size-base flex flex-col gap-4">
      <NotificationBanner
        variant="error"
        Icon={ErrorIcon}
        description={translate("preSimulationChecks.failed.warning")}
        className="border rounded-md"
      />
      <p>{translate("preSimulationChecks.failed.body")}</p>
    </div>
  );
};

const SummaryBody = ({ failingRules }: { failingRules: string[] }) => {
  const translate = useTranslate();
  const listed = failingRules.slice(0, MAX_LISTED_RULES);
  const remaining = failingRules.length - listed.length;

  return (
    <div className="p-4 text-size-base flex flex-col gap-4">
      <NotificationBanner
        variant="warning"
        Icon={WarningIcon}
        description={translate("preSimulationChecks.warning")}
        className="border rounded-md"
      />
      <div className="flex flex-col gap-2">
        <p>{translate("preSimulationChecks.body")}</p>
        <ul className="list-disc pl-5 space-y-1">
          {listed.map((ruleId) => (
            <li key={ruleId}>{translate(ruleLabelKey(ruleId))}</li>
          ))}
        </ul>
        {remaining > 0 && (
          <p className="text-default">
            {translate("preSimulationChecks.andMoreRules", remaining)}
          </p>
        )}
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
  const { onReview, onRunAnyway, onCancel } = modal;

  const closeThen = (action: () => void) => () => {
    onClose();
    action();
  };

  if (modal.status === "running") {
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
          onAction={closeThen(onReview)}
          secondary={{
            action: translate("preSimulationChecks.runAnyway"),
            onClick: closeThen(onRunAnyway),
          }}
        />
      }
    >
      {modal.status === "failed" ? (
        <FailedBody />
      ) : (
        <SummaryBody failingRules={modal.failingRules} />
      )}
    </BaseDialog>
  );
};
