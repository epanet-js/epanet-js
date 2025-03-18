import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { GlobeIcon } from "@radix-ui/react-icons";
import { SignInButton, SignUpButton } from "src/auth";
import { Button } from "../elements";
import { SimpleDialogButtons } from "./simple_dialog_actions";
import { useUserTracking } from "src/infra/user-tracking";

export const UnlockFullResolutionDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const userTracking = useUserTracking();

  return (
    <>
      <DialogHeader
        title={translate("signUpToUnlockResolution")}
        titleIcon={GlobeIcon}
      />
      <p className="text-sm">{translate("signUpToUnlockResolutionDetail")}</p>
      <SimpleDialogButtons>
        <SignUpButton
          autoFocus={true}
          onClick={() => {
            userTracking.capture({
              name: "signUp.started",
              source: "satelliteResolutionLimit",
            });
          }}
        />
        <SignInButton
          onClick={() => {
            userTracking.capture({
              name: "signIn.started",
              source: "satelliteResolutionLimit",
            });
          }}
        />
        <Divider />
        <Button onClick={onClose}>
          {translate("continueWithLowResolution")}
        </Button>
      </SimpleDialogButtons>
    </>
  );
};
export const Divider = () => {
  return <div className="border-r-2 border-gray-100 h-8 "></div>;
};
