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
    <DialogContainer size="sm">
      <DialogHeader
        titleIcon={EarlyAccessIcon}
        title={translate("earlyAccessDialog.title")}
      />
      <Formik onSubmit={() => {}} initialValues={{}}>
        <Form>
          <p className="text-sm text-gray">
            {translate("earlyAccessDialog.description")}
          </p>
          {isAuthEnabled ? (
            <div className="flex gap-3 justify-end pt-4">
              <Button variant="default" onClick={closeDialog}>
                {translate("cancel")}
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
                  {translate("earlyAccessDialog.getAccess")}
                </Button>
              </ClerkSignInButton>
            </div>
          ) : (
            <SimpleDialogActions
              secondary={{
                action: translate("cancel"),
                onClick: closeDialog,
              }}
            />
          )}
        </Form>
      </Formik>
    </DialogContainer>
  );
};
