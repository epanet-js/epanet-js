import {
  AckDialogAction,
  BaseDialog,
  LoadingDialog,
  useDialogState,
} from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { CheckoutButton } from "../components/checkout-button";
import { Button } from "../components/elements";
import { ForwardRefExoticComponent, RefAttributes, useState } from "react";
import clsx from "clsx";
import { IconProps } from "@radix-ui/react-icons/dist/types";
import { Tooltip } from "@epanet-js/ui-kit";
import { useUserTracking } from "src/infra/user-tracking";
import {
  pricingPageUrl,
  studentAccountActiviationHelpUrl,
  requestQuoteFormUrl,
} from "src/global-config";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { useAuth } from "src/hooks/use-auth";
import { PaymentType } from "src/hooks/use-checkout";
import {
  useActivateTrial,
  useIsTrialEmailRefused,
} from "src/hooks/use-activate-trial";
import { usePermissions } from "src/hooks/use-permissions";
import { signUpUrl } from "src/global-config";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  InfoIcon,
  CloseIcon,
  RefreshIcon,
  BotIcon,
  ChevronDownIcon,
  GaugeIcon,
  HammerIcon,
  InfiniteIcon,
  SlidersHorizontalIcon,
} from "src/icons";
import type { UpgradeOrigin } from "src/state/dialog";

type UsageOption = "commercial" | "non-commercial";

const prices = {
  personal: {
    yearly: "$100",
  },
};

export const UpgradeDialog = ({
  feature = "upgradeMenu",
  source = "upgrade",
}: { feature?: string; source?: UpgradeOrigin } = {}) => {
  const { isLoaded: isAuthLoaded } = useAuth();
  const { canUpgrade } = usePermissions();

  if (!isAuthLoaded) return <LoadingDialog />;

  if (!canUpgrade) {
    return <ChangesFromSupportDialog />;
  }

  return <PricingPlansDialog feature={feature} source={source} />;
};

const ChangesFromSupportDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  return (
    <BaseDialog
      title={translate("planChangesFromSupport")}
      size="md"
      isOpen={true}
      onClose={closeDialog}
      footer={
        <AckDialogAction label={translate("understood")} onAck={closeDialog} />
      }
    >
      <p className="p-4 text text-size-base">
        {translate("planChangesFromSupportExplain")}
      </p>
    </BaseDialog>
  );
};

const PricingPlansDialog = ({
  feature,
  source,
}: {
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const [usage, setUsage] = useState<UsageOption>("commercial");
  const [paymentType, setPaymentType] = useState<PaymentType>("yearly");
  const userTracking = useUserTracking();

  const handleUsageChange = (newUsage: UsageOption) => {
    userTracking.capture({ name: "planUsage.toggled" });
    setUsage(newUsage);
  };

  const handlePaymentChange = (newPaymentType: PaymentType) => {
    userTracking.capture({ name: "planPaymentType.toggled" });
    setPaymentType(newPaymentType);
  };

  const { closeDialog } = useDialogState();
  const handleClose = () => {
    userTracking.capture({
      name: "upgradeDialog.dismissed",
      source,
      sourceFeature: feature,
    });
    closeDialog();
  };

  return (
    <BaseDialog
      title={translate("upgradeYourAccount")}
      size="xl"
      isOpen={true}
      onClose={handleClose}
      footer={
        <footer className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t text-size-base">
          {usage === "commercial" ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-accent-hover hover:underline"
              onClick={() => handleUsageChange("non-commercial")}
            >
              {translate("pricingPlans.nonCommercialPlans")}
              <ArrowRightIcon />
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-accent-hover hover:underline"
              onClick={() => handleUsageChange("commercial")}
            >
              <ArrowLeftIcon />
              {translate("pricingPlans.backToCommercial")}
            </button>
          )}
          <a
            className="text-accent-hover hover:underline"
            target="_blank"
            href={pricingPageUrl}
          >
            {translate("pricingPlans.seeAllPlans")}
          </a>
        </footer>
      }
    >
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mx-auto">
          <PricingFreePlan />
          {/* Both views share one grid cell, so the dialog keeps the taller one's height. */}
          <div className="grid md:col-span-2">
            <div
              aria-hidden={usage !== "commercial"}
              className={clsx(
                "[grid-area:1/1] grid grid-cols-1 md:grid-cols-2 gap-6",
                usage !== "commercial" && "invisible",
              )}
            >
              <PricingProPlan
                paymentType={paymentType}
                onPaymentChange={handlePaymentChange}
                feature={feature}
                source={source}
              />
              <UltimatePlan feature={feature} source={source} />
            </div>
            <div
              aria-hidden={usage !== "non-commercial"}
              className={clsx(
                "[grid-area:1/1] grid grid-cols-1 md:grid-cols-2 gap-6",
                usage !== "non-commercial" && "invisible",
              )}
            >
              <PricingPersonalPlan feature={feature} source={source} />
              <PricingEducationPlan />
            </div>
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};

const StartTrialButton = ({
  feature,
  source,
}: {
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { closeDialog } = useDialogState();
  const { activateTrial, isLoading } = useActivateTrial();

  const startTrial = async () => {
    userTracking.capture({ name: "trial.clickedStart", source, feature });

    const activated = await activateTrial();
    if (!activated) return;

    closeDialog();
  };

  return (
    <Button
      variant="primary"
      size="full-width"
      className="relative"
      onClick={() => void startTrial()}
      disabled={isLoading}
    >
      <span className={isLoading ? "invisible" : undefined}>
        {translate("trial.startFree")}
      </span>
      {isLoading && <RefreshIcon className="animate-spin absolute" />}
    </Button>
  );
};

const checkItem = (feature: string, tooltip?: string) => ({
  feature,
  Icon: CheckIcon,
  iconColor: "text-success",
  tooltip,
});

const PricingFreePlan = () => {
  const translate = useTranslate();
  return (
    <div className="bg-base border rounded-md shadow-md overflow-hidden flex flex-col justify-between">
      <div className="p-6 flex flex-col gap-6 flex-1">
        <PricingPlanHeader
          name="Free"
          price="$0"
          claim={translate("pricingPlans.free.claim")}
          payment="yearly"
        />
        <FeaturesList
          className=""
          title={translate("pricingPlans.free.includes")}
          items={[
            checkItem(translate("pricingPlans.free.engine")),
            checkItem(translate("pricingPlans.free.noLimits")),
            checkItem(translate("pricingPlans.free.runsLocally")),
          ]}
        />
      </div>
      <div className="px-4 pb-4 w-full">
        <Button
          size="full-width"
          className="default-pointer bg-gray-300 text-default"
          disabled={true}
        >
          <CheckIcon />
          {translate("currentPlan")}
        </Button>
      </div>
    </div>
  );
};

const PricingProPlan = ({
  paymentType,
  onPaymentChange,
  feature,
  source,
}: {
  paymentType: PaymentType;
  onPaymentChange: (paymentType: PaymentType) => void;
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const { user, isSignedIn } = useAuth();
  const isTrialEmailRefused = useIsTrialEmailRefused();
  const canStartTrial =
    paymentType === "yearly" &&
    !!isSignedIn &&
    !user.hasUsedTrial &&
    !isTrialEmailRefused;

  return (
    <div className="relative bg-base border border-purple-100 rounded-lg shadow-md shadow-purple-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6 flex flex-col gap-6 flex-1">
        <div className="absolute top-0 right-0 bg-linear-to-br from-purple-300 via-purple-400 to-purple-500 text-white text-size-small font-semibold py-1 px-2 rounded-bl-lg">
          {translate("mostPopular")}
        </div>
        <PricingPlanHeader
          name="Pro"
          price={proPrices[paymentType]}
          payment={paymentType}
          onPaymentChange={onPaymentChange}
          claim={translate("pricingPlans.pro.per")}
        />
        <div>
          <FeaturesList
            className=""
            title={translate("everythingAnd", "Free")}
            items={[
              checkItem(translate("scenariosItem")),
              checkItem(
                translate("proModelBuilder"),
                translate("pricingPlans.pro.modelBuilderInfo"),
              ),
              checkItem(translate("customAttributesItem")),
              checkItem(translate("pricingPlans.pro.customMapLayers")),
              checkItem(translate("scriptingItem")),
              checkItem(translate("professionalSupport")),
            ]}
          />
          <p className="mt-4 text-size-base text-subtle">
            {translate("pricingPlans.pro.andMore")}
          </p>
        </div>
      </div>
      <div className="flex flex-col px-4 pb-4 gap-y-3 w-full">
        {canStartTrial ? (
          <StartTrialButton feature={feature} source={source} />
        ) : (
          <CheckoutButton
            plan="pro"
            paymentType={paymentType}
            feature={feature}
            source={source}
          >
            {translate("upgradeTo", "Pro")}
          </CheckoutButton>
        )}
        <QuoteButton label={translate("requestQuote")} />
      </div>
    </div>
  );
};

const PricingPersonalPlan = ({
  feature,
  source,
}: {
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();

  return (
    <div className="relative bg-base border border-purple-100 rounded-lg shadow-md shadow-purple-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6 flex flex-col gap-6 flex-1">
        <div className="absolute top-0 right-0 bg-linear-to-br from-purple-300 via-purple-400 to-purple-500 text-white text-size-small font-semibold py-1 px-2 rounded-bl-lg">
          {translate("mostPopular")}
        </div>
        <PricingPlanHeader
          name="Personal"
          price={prices.personal.yearly}
          payment="yearly"
          claim={translate("tryItYourself")}
        />
        <FeaturesList
          className=""
          title={translate("everythingAnd", "Free")}
          items={[
            checkItem(translate("scenariosItem")),
            {
              feature: translate("proModelBuilder"),
              Icon: CloseIcon,
              iconColor: "text-red-500",
              tooltip: translate("modelBuilderInfo"),
            },
            checkItem(translate("customAttributesItem")),
            checkItem(translate("pricingPlans.pro.customMapLayers")),
            checkItem(translate("scriptingItem")),
            {
              feature: translate("professionalSupport"),
              Icon: CloseIcon,
              iconColor: "text-red-500",
            },
          ]}
        />
      </div>
      <div className="px-4 pb-4 w-full">
        <CheckoutButton
          plan="personal"
          paymentType="yearly"
          feature={feature}
          source={source}
        >
          {translate("upgradeTo", "Personal")}
        </CheckoutButton>
      </div>
    </div>
  );
};

const PricingEducationPlan = () => {
  const translate = useTranslate();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { isSignedIn, signOut } = useAuth();
  const userTracking = useUserTracking();

  return (
    <div className="relative bg-base border rounded-lg shadow-md shadow-gray-300 overflow-hidden flex flex-col h-fit">
      <div className="p-6 flex flex-col gap-6 flex-1">
        <PricingPlanHeader
          name="Education"
          price="$0"
          payment="yearly"
          claim={translate("learnWithEpanetJS")}
        />
        <p className="text-size-base text-subtle">
          {translate("everythingInForFree", "Personal")}
        </p>
      </div>
      <div className="flex flex-col px-4 pb-4 gap-y-3">
        <Button
          size="full-width"
          className="default-pointer bg-panel text-default"
          onClick={() => {
            userTracking.capture({ name: "studentLogin.clicked" });
            checkUnsavedChanges(() => {
              if (isSignedIn) {
                void signOut({ redirectUrl: signUpUrl });
              } else {
                window.location.href = signUpUrl;
              }
            });
          }}
        >
          {translate("useStudentEmail")}
        </Button>
        <div className="text-size-small text-center text-subtle">
          <p>{translate("havingIssuesWithStudentEmail")}</p>
          <a
            className="text-accent-hover hover:underline"
            target="_blank"
            href={studentAccountActiviationHelpUrl}
            onClick={() => {
              userTracking.capture({
                name: "helpCenter.visited",
                source: "educationPlan",
              });
            }}
          >
            {translate("getHelp")}.
          </a>
        </div>
      </div>
    </div>
  );
};

const UltimatePlan = ({
  feature,
  source,
}: {
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();

  const captureCheckoutStarted = () => {
    userTracking.capture({
      name: "checkout.started",
      plan: "teams",
      paymentType: "yearly",
      source,
      sourceFeature: feature,
    });
  };

  return (
    <div className="relative bg-base border rounded-md shadow-md shadow-gray-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6 flex flex-col gap-6 flex-1">
        <PricingPlanHeader
          name="Ultimate"
          price={ultimatePrice}
          payment="yearly"
          claim={translate("pricingPlans.ultimate.per", "3")}
        />
        <div>
          <FeaturesList
            className=""
            title={translate("everythingAnd", "Pro")}
            items={[
              checkItem(translate("pricingPlans.ultimate.sharedCloudModels")),
              checkItem(translate("pricingPlans.ultimate.teamBranching")),
              checkItem(translate("pricingPlans.ultimate.rolesAndPermissions")),
              checkItem(translate("selfServiceSeatManagement")),
              checkItem(translate("payByInvoice")),
              checkItem(translate("pricingPlans.ultimate.teamOnboarding")),
            ]}
          />
          <FeaturesList
            className="mt-6"
            title={translate("pricingPlans.ultimate.advancedWorkflows")}
            items={[
              {
                feature: translate("pricingPlans.ultimate.automatedModelBuild"),
                Icon: HammerIcon,
                iconColor: "text-default",
              },
              {
                feature: translate("pricingPlans.ultimate.calibrationTools"),
                Icon: SlidersHorizontalIcon,
                iconColor: "text-default",
              },
              {
                feature: translate(
                  "pricingPlans.ultimate.unlimitedConversions",
                ),
                Icon: InfiniteIcon,
                iconColor: "text-default",
              },
              {
                feature: translate(
                  "pricingPlans.ultimate.shutdownsAndInquiries",
                ),
                Icon: GaugeIcon,
                iconColor: "text-default",
              },
              {
                feature: translate("pricingPlans.ultimate.aiAssistedModeling"),
                Icon: BotIcon,
                iconColor: "text-default",
              },
            ]}
          />
        </div>
      </div>
      <div className="px-4 pb-4 w-full">
        <QuoteButton
          label={translate("requestQuote")}
          onClick={captureCheckoutStarted}
        />
      </div>
    </div>
  );
};

const PricingPlanHeader = ({
  name,
  claim,
  price,
  payment,
  onPaymentChange,
}: {
  name: string;
  claim: string;
  price: string;
  payment: PaymentType;
  onPaymentChange?: (payment: PaymentType) => void;
}) => {
  const translate = useTranslate();
  const periodLabels: Record<PaymentType, string> = {
    yearly: `/${translate("yearShort")}`,
    monthly: `/${translate("monthShort")}`,
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-size-heading-2 leading-6 font-semibold mb-2">
        {name}
      </h2>
      <p className="text-subtle text-size-base leading-6">{claim}</p>
      <div>
        <strong className="text-3xl leading-10 font-bold">{price}</strong>
        {onPaymentChange ? (
          <BillingPeriodSelect
            value={payment}
            onChange={onPaymentChange}
            labels={periodLabels}
          />
        ) : (
          <span className="text-size-base text-subtle">
            {periodLabels[payment]}
          </span>
        )}
      </div>
    </div>
  );
};

type SlottableIcon =
  | React.FC<React.ComponentProps<"svg">>
  | ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

export const FeaturesList = ({
  title,
  textColor = "text-default",
  className = "my-4",
  items,
}: {
  title?: string;
  textColor?: string;
  className?: string;
  items: {
    feature: string;
    Icon: SlottableIcon;
    iconColor: string;
    tooltip?: string;
  }[];
}) => {
  return (
    <div className={className}>
      {title && <p className="text-size-base text-subtle mb-2">{title}</p>}
      <ul className="space-y-2 grow">
        {items.map(({ feature, Icon, iconColor, tooltip }, index) => (
          <li
            key={index}
            className={`flex items-start text-size-base ${textColor}`}
          >
            <Icon className={`h-5 w-5 ${iconColor} shrink-0 mr-2`} />
            <span className="flex items-center gap-1">
              {feature}
              {tooltip && <InfoTooltip text={tooltip} />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const InfoTooltip = ({ text }: { text: string }) => {
  return (
    <Tooltip
      className="max-w-xs!"
      content={text}
      variant="contrast"
      side="top"
      align="start"
      delayDuration={100}
      zIndex={50}
    >
      <button className="rounded-full hover:bg-base-hover">
        <InfoIcon className="w-5 h-5 text-subtle" />
      </button>
    </Tooltip>
  );
};

const proPrices = {
  yearly: "$950",
  monthly: "$250",
};

const ultimatePrice = "$10,000";

const BillingPeriodSelect = ({
  value,
  onChange,
  labels: customLabels,
}: {
  value: PaymentType;
  onChange: (value: PaymentType) => void;
  labels?: Record<PaymentType, string>;
}) => {
  const translate = useTranslate();
  const labels: Record<PaymentType, string> = customLabels ?? {
    yearly: translate("pricingPlans.perYear"),
    monthly: translate("pricingPlans.perMonth"),
  };

  return (
    <label className="relative ml-1 inline-flex items-center gap-0.5 text-size-base text-subtle has-focus-visible:underline">
      <span aria-hidden="true">{labels[value]}</span>
      <ChevronDownIcon className="pointer-events-none" />
      <select
        aria-label={translate("pricingPlans.billingPeriod")}
        value={value}
        onChange={(event) => onChange(event.target.value as PaymentType)}
        className="absolute inset-0 w-full cursor-pointer appearance-none opacity-0"
      >
        <option value="yearly">{labels.yearly}</option>
        <option value="monthly">{labels.monthly}</option>
      </select>
    </label>
  );
};

const QuoteButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) => {
  const userTracking = useUserTracking();

  const goToQuoteForm = () => {
    userTracking.capture({ name: "teamsRequest.clicked" });
    onClick?.();
    window.open(requestQuoteFormUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      size="full-width"
      className="default-pointer bg-panel text-default"
      onClick={goToQuoteForm}
    >
      {label}
    </Button>
  );
};
