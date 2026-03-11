import {
  DialogContainer,
  DialogHeader,
  useDialogState,
  SimpleDialogActions,
  BaseModal,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
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
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const { closeDialog } = useDialogState();
  const userTracking = useUserTracking();
  const translate = useTranslate();

  const redirectUrl = afterSignupDialog
    ? buildAfterSignupUrl(afterSignupDialog)
    : undefined;

  if (isModalsOn) {
    return (
      <BaseModal
        title={translate("earlyAccessDialog.title")}
        size="sm"
        isOpen={true}
        onClose={closeDialog}
        footer={
          isAuthEnabled ? (
            <div className="flex gap-3 justify-end px-4 py-3 border-t border-gray-200">
              <Button variant="default" onClick={closeDialog}>
                {translate("dialog.cancel")}
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
            <SimpleDialogActionsNew onClose={closeDialog} />
          )
        }
      >
        <div className="p-4">
          <p className="text-sm text-gray">
            {translate("earlyAccessDialog.description")}
          </p>
        </div>
      </BaseModal>
    );
  }

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
                {translate("dialog.cancel")}
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
                action: translate("dialog.cancel"),
                onClick: closeDialog,
              }}
            />
          )}
        </Form>
      </Formik>
    </DialogContainer>
  );
};
