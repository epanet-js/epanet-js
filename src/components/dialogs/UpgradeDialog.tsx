import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { RocketIcon } from "@radix-ui/react-icons";
import { CheckoutButton } from "../checkout-button";

export const UpgradeDialog = () => {
  return (
    <>
      <DialogHeader
        title={translate("upgradeYourAccount")}
        titleIcon={RocketIcon}
      />
      <CheckoutButton />
    </>
  );
};
