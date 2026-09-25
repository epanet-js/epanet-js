import { BaseDialog } from "src/components/dialog";
import { SignInButton } from "src/components/auth/sign-in-button";
import { Button } from "src/components/elements";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

export const ScenarioSignInDialog = ({ onClose }: { onClose: () => void }) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("scenarios.signIn.title")}
      size="md"
      isOpen={true}
      onClose={onClose}
      footer={
        <div className="flex gap-3 justify-end px-4 py-3 border-t">
          <Button variant="default" onClick={onClose}>
            {translate("dialog.cancel")}
          </Button>
          <SignInButton>
            <Button
              variant="primary"
              onClick={() => {
                userTracking.capture({
                  name: "signIn.started",
                  source: "scenarioSwitcher",
                });
                onClose();
              }}
            >
              {translate("scenarios.signIn.action")}
            </Button>
          </SignInButton>
        </div>
      }
    >
      <div className="p-4">
        <p className="text-size-base text-default">
          {translate("scenarios.signIn.description")}
        </p>
      </div>
    </BaseDialog>
  );
};
