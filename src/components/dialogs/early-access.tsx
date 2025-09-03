import {
  DialogContainer,
  DialogHeader,
  useDialogState,
  SimpleDialogActions,
} from "src/components/dialog";
import { ClerkSignInButton, isAuthEnabled } from "src/auth";
import { buildAfterSignupUrl } from "src/hooks/use-early-access";
import { Button } from "src/components/elements";
import { Form, Formik } from "formik";
import { useUserTracking } from "src/infra/user-tracking";
import { EarlyAccessIcon } from "src/icons";

export const EarlyAccessDialog = ({
  onContinue: _onContinue,
  afterSignupDialog,
}: {
  onContinue: () => void;
  afterSignupDialog?: string;
}) => {
  const { closeDialog } = useDialogState();
  const userTracking = useUserTracking();

  const redirectUrl = afterSignupDialog
    ? buildAfterSignupUrl(afterSignupDialog)
    : undefined;
  return (
    <DialogContainer size="sm">
      <DialogHeader titleIcon={EarlyAccessIcon} title="Early Access Feature" />
      <Formik onSubmit={() => {}} initialValues={{}}>
        <Form>
          <p className="text-sm text-gray">
            This feature is in early access, and we're excited to share it with
            our signed-in users first. We're still actively making improvements,
            and your feedback will help us make it even better.
          </p>
          {isAuthEnabled ? (
            <div className="flex gap-3 justify-end pt-4">
              <Button variant="default" onClick={closeDialog}>
                Cancel
              </Button>
              <ClerkSignInButton
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
                  Get Early Access
                </Button>
              </ClerkSignInButton>
            </div>
          ) : (
            <SimpleDialogActions
              secondary={{
                action: "Cancel",
                onClick: closeDialog,
              }}
            />
          )}
        </Form>
      </Formik>
    </DialogContainer>
  );
};
