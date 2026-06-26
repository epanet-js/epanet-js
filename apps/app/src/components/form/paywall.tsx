import { useCallback } from "react";
import { useSetAtom } from "jotai";
import * as Tooltip from "@radix-ui/react-tooltip";
import { dialogAtom, type PaywallFeature } from "src/state/dialog";
import { usePaywall } from "src/hooks/use-paywall";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { PaywallLockIcon } from "src/icons";
import { Button, TContent, StyledTooltipArrow } from "src/components/elements";

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

// Purely visual dim that fades blocked content into the panel background. The
// gradient reaches the opaque background early (well before the bottom) so only
// the first rows stay legible and the rest fade out aggressively.
const FadeGradient = () => (
  <div
    aria-hidden
    className="absolute inset-0 pointer-events-none bg-linear-to-b from-transparent via-popover via-65% to-popover"
  />
);

export const PaywallFade = ({
  feature,
  className,
  children,
}: {
  feature: PaywallFeature;
  className?: string;
  children: React.ReactNode;
}) => {
  const { openPaywall } = useFeatureLock(feature);

  return (
    <div
      className={`relative ${className ?? ""}`}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openPaywall();
      }}
    >
      {children}
      <FadeGradient />
    </div>
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

// Bordered CTA card explaining a paid feature, with an Upgrade button that opens
// the paywall. Useful for list-shaped paywalls where a per-field lock icon
// wouldn't convey that the whole list is gated.
export const PaywallUpgradeBox = ({
  feature,
  title,
  description,
}: {
  feature: PaywallFeature;
  title: string;
  description: string;
}) => {
  const translate = useTranslate();
  const { openPaywall } = useFeatureLock(feature);

  return (
    <div className="mx-3 mb-3 rounded-lg border border-purple-200 bg-base p-4 shadow-md dark:border-purple-900">
      <h3 className="font-bold text-size-base">{title}</h3>
      <p className="mt-1 mb-3 text-subtle text-size-base">{description}</p>
      <Button variant="primary" onClick={openPaywall}>
        {translate("upgrade")}
      </Button>
    </div>
  );
};
