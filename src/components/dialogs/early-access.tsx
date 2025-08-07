import { StarIcon } from "@radix-ui/react-icons";
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

export const EarlyAccessDialog = ({
  onContinue: _onContinue,
  afterSignupDialog,
}: {
  onContinue: () => void;
  afterSignupDialog?: string;
}) => {
  const { closeDialog } = useDialogState();

  const redirectUrl = afterSignupDialog
    ? buildAfterSignupUrl(afterSignupDialog)
    : undefined;

  return (
    <DialogContainer size="sm">
      <DialogHeader titleIcon={StarIcon} title="Early Access Feature" />
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
                <Button variant="primary">Get Early Access</Button>
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
