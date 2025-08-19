import { useEffect, useState } from "react";
import { DialogContainer, DialogHeader } from "src/components/dialog";
import { getCheckoutUrlParams } from "src/hooks/use-checkout";
import { RocketIcon } from "@radix-ui/react-icons";
import { useTranslate } from "src/hooks/use-translate";
import { useBreakpoint } from "src/hooks/use-breakpoint";

type IframeUpgradeDialogProps = {
  onClose: () => void;
};

export const IframeUpgradeDialog = ({ onClose }: IframeUpgradeDialogProps) => {
  const translate = useTranslate();
  const [iframeHeight, setIframeHeight] = useState<string>("auto");

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "close") {
        onClose();
      } else if (event.data.type === "iframeHeight" && event.data.height) {
        setIframeHeight(`${event.data.height}px`);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onClose]);

  const checkoutParams = getCheckoutUrlParams();
  const iframeUrl = checkoutParams.enabled
    ? `/upgrade?startCheckout=true&plan=${checkoutParams.plan}&paymentType=${checkoutParams.paymentType}`
    : "/upgrade";

  const isMdOrLarger = useBreakpoint("md");

  return (
    <DialogContainer size={isMdOrLarger ? "lg" : "fullscreen"}>
      <DialogHeader
        title={translate("upgradeYourAccount")}
        titleIcon={RocketIcon}
      />
      <div className="relative">
        <iframe
          src={iframeUrl}
          className="w-full border-0"
          title="Upgrade Account"
          style={{ height: iframeHeight }}
        />
      </div>
    </DialogContainer>
  );
};
