import type { LoadingScenarioDialogState } from "src/state/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Loading } from "src/components/elements";
import { BaseDialog } from "../components/dialog";

export const LoadingScenarioDialog = ({
  modal,
}: {
  modal: LoadingScenarioDialogState;
}) => {
  const translate = useTranslate();

  return (
    <BaseDialog size="xs" isOpen={true} onClose={() => {}} preventClose={true}>
      <Loading
        text={translate("scenarios.loadingScenario", modal.scenarioName)}
      />
    </BaseDialog>
  );
};
