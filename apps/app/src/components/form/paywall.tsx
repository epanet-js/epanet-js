import { useCallback } from "react";
import { useSetAtom } from "jotai";
import * as Tooltip from "@radix-ui/react-tooltip";
import { dialogAtom, type PaywallFeature } from "src/state/dialog";
import { usePaywall } from "src/hooks/use-paywall";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { PaywallLockIcon } from "src/icons";
import { TContent, StyledTooltipArrow } from "src/components/elements";

export const useFeatureLock = (feature: PaywallFeature | undefined) => {
  const paywallDialog = usePaywall(feature);
  const setDialog = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const openPaywall = useCallback(() => {
    if (!paywallDialog || !feature) return;
    userTracking.capture({ name: "paywallLock.clicked", feature });
    setDialog(paywallDialog);
  }, [paywallDialog, setDialog, userTracking, feature]);
  return { isLocked: paywallDialog !== null, openPaywall };
};

export const PaywallLockButton = ({
  feature,
  label,
}: {
  feature: PaywallFeature;
  label: string;
}) => {
  const translate = useTranslate();
  const { openPaywall } = useFeatureLock(feature);
  const tooltip = translate("paywall.tooltip");

  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={`${tooltip}: ${label}`}
          onClick={openPaywall}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
        >
          <PaywallLockIcon />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <TContent side="top">
          <StyledTooltipArrow />
          {tooltip}
        </TContent>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};

export const PaywallOverlay = ({
  feature,
  ariaLabel,
  children,
}: {
  feature: PaywallFeature;
  ariaLabel: string;
  children: React.ReactNode;
}) => {
  const translate = useTranslate();
  const { openPaywall } = useFeatureLock(feature);

  return (
    <div className="relative">
      <div className="pointer-events-none select-none">{children}</div>
      <button
        type="button"
        aria-label={`${translate("paywall.tooltip")}: ${ariaLabel}`}
        onClick={openPaywall}
        className="absolute inset-0 w-full h-full cursor-pointer bg-transparent"
      />
    </div>
  );
};
