import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { DialogCloseX } from "src/components/dialog";
import { Button } from "src/components/elements";
import { BrandLogo } from "src/components/menu_bar";
import { dialogAtom } from "src/state/dialog_state";

export const useShowWelcome = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const showWelcome = useCallback(() => {
    setDialogState({ type: "welcome" });
  }, [setDialogState]);

  return showWelcome;
};

export const WelcomeDialog = ({}: { onClose: () => void }) => {
  const imageUrl = "https://placehold.co/512x720";
  return (
    <div className="w-full flex flex-row h-full">
      <div className="w-1/2 flex flex-col justify-between">
        <img src={imageUrl} alt="Dialog Image" className="w-full h-full" />
      </div>
      <div className="w-1/2 h-full flex flex-col p-4 justify-between">
        <div className="flex flex-col flex-grow">
          <div className="w-full flex flex-row justify-between items-center pb-3">
            <BrandLogo textSize="2xl" iconSize="12" gapX="1" />
            <DialogCloseX />
          </div>
          <div className="flex-grow flex flex-col items-stretch flex-1 p-1 justify-between">
            <p className="text-gray-500 text-lg font-semibold pb-2">
              Welcome to epanet-js!
            </p>
            <p className="text-sm pb-3">
              epanet-js is a modern web-based EPANET platform, designed for
              utilities and those tackling complex distribution modeling. We’re
              reimagining the way planning engineers manage the future of their
              networks by replacing cumbersome, traditional desktop software
              with an intuitive, web-based tool.
            </p>
            <p className="text-gray-500 text-lg font-semibold pb-2">
              Example networks
            </p>
            <div className="grid grid-cols-2 gap-4 pb-3">
              <DemoNetworkCard
                title="UK Style Network"
                description="Sample network for demo purposes"
              />
              <DemoNetworkCard
                title="US Style Network"
                description="Sample network for demo purposes"
              />
            </div>
            <p className="text-gray-500 text-lg font-semibold pb-2">
              Build & Develop
            </p>
            <div className="flex flex-col gap-y-2 pb-3">
              <Button size="full-width">Create New</Button>
              <Button size="full-width">Open INP</Button>
            </div>
            <p className="text-gray-500 text-lg font-semibold pb-2">
              Helpful links
            </p>
            <div className="grid grid-cols-3 gap-3 pb-3">
              <Button size="full-width">Quick start tutorial</Button>
              <Button size="full-width">Help center</Button>
              <Button size="full-width">Source code</Button>
            </div>
            <div className="text-sm pb-3 flex items-center gap-x-1">
              <input type="checkbox" checked />
              Always show at startup
            </div>
          </div>
        </div>
        <div className="flex flex-row items-center justify-center mt-auto text-xs gap-x-1">
          <span>Terms and Conditions</span>
          <span>|</span>
          <span>Privacy policy</span>
        </div>
      </div>
    </div>
  );
};

const DemoNetworkCard = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  const demoPlaceholder = "https://placehold.co/64x96";

  return (
    <div className="flex items-center gap-x-2 bg-white shadow-md  rounded-lg border">
      <img
        src={demoPlaceholder}
        alt="Demo network 1"
        className="w-[64px] h-[96px] object-cover"
      />
      <div className="flex flex-col p-1">
        <span className="text-gray-600 font-bold text-sm">{title}</span>
        <span className="text-xs">{description}</span>
      </div>
    </div>
  );
};
