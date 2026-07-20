import {
  useDialogState,
  BaseDialog,
  SimpleDialogActions,
} from "src/components/dialog";
import { SignInButton } from "src/components/auth/sign-in-button";
import { isAuthEnabled } from "src/global-config";
import { buildAfterSignupUrl } from "src/hooks/use-early-access";
import { Button } from "src/components/elements";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

export const EarlyAccessDialog = ({
  onContinue: _onContinue,
  afterSignupDialog,
}: {
  onContinue: () => void;
  afterSignupDialog?: string;
}) => {
  const { closeDialog } = useDialogState();
  const userTracking = useUserTracking();
  const translate = useTranslate();

  const redirectUrl = afterSignupDialog
    ? buildAfterSignupUrl(afterSignupDialog)
    : undefined;

  return (
    <BaseDialog
      title={translate("earlyAccessDialog.title")}
      size="md"
      isOpen={true}
      onClose={closeDialog}
      footer={
        isAuthEnabled ? (
          <div className="flex gap-3 justify-end px-4 py-3 border-t">
            <Button variant="default" onClick={closeDialog}>
              {translate("dialog.cancel")}
            </Button>
            <SignInButton
              signUpForceRedirectUrl={redirectUrl}
              forceRedirectUrl={redirectUrl}
            >
              <Button
                variant="primary"
                onClick={() => {
                  userTracking.capture({
                    name: "earlyAccess.clickedGet",
                    source: "earlyAccessDialog",
                  });
                }}
              >
                {translate("earlyAccessDialog.getAccess")}
              </Button>
            </SignInButton>
          </div>
        ) : (
          <SimpleDialogActions onClose={closeDialog} />
        )
      }
    >
      <div className="p-4">
        <p className="text-size-base text-gray">
          {translate("earlyAccessDialog.description")}
        </p>
      </div>
    </BaseDialog>
  );
};
