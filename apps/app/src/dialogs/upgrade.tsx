import {
  AckDialogAction,
  BaseDialog,
  LoadingDialog,
  useDialogState,
} from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { CheckoutButton } from "../components/checkout-button";
import { Button, StyledSwitch, StyledThumb } from "../components/elements";
import {
  ForwardRefExoticComponent,
  ReactNode,
  RefAttributes,
  useMemo,
  useState,
} from "react";
import clsx from "clsx";
import { IconProps } from "@radix-ui/react-icons/dist/types";
import { Selector, Tooltip } from "@epanet-js/ui-kit";
import { useUserTracking } from "src/infra/user-tracking";
import {
  studentAccountActiviationHelpUrl,
  teamsPlanRequestFormUrl,
} from "src/global-config";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { useAuth } from "src/hooks/use-auth";
import { PaymentType, useCheckout } from "src/hooks/use-checkout";
import {
  useActivateTrial,
  useIsTrialEmailRefused,
} from "src/hooks/use-activate-trial";
import { usePermissions } from "src/hooks/use-permissions";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { signUpUrl } from "src/global-config";
import {
  CheckIcon,
  InfoIcon,
  CloseIcon,
  RefreshIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BotIcon,
  ChevronDownIcon,
  ClockIcon,
  GaugeIcon,
  GraduationCapIcon,
  HammerIcon,
  InfiniteIcon,
  SlidersHorizontalIcon,
  UserIcon,
} from "src/icons";
import type { UpgradeOrigin } from "src/state/dialog";

type UsageOption = "commercial" | "non-commercial";

const prices = {
  pro: {
    monthly: "$95",
    yearly: "$950",
  },
  personal: {
    yearly: "$100",
  },
  teams: {
    baseMonthly: "$440",
    baseYearly: "$4400",
    userMonthly: "$60",
    userYearly: "$600",
  },
};

export const UpgradeDialog = ({
  feature = "upgradeMenu",
  source = "upgrade",
}: { feature?: string; source?: UpgradeOrigin } = {}) => {
  const { isLoaded: isAuthLoaded } = useAuth();
  const { canUpgrade } = usePermissions();
  const isPricingUpgradeOn = useFeatureFlag("FLAG_PRICING_UPGRADE");

  if (!isAuthLoaded) return <LoadingDialog />;

  if (!canUpgrade) {
    return <ChangesFromSupportDialog />;
  }

  if (isPricingUpgradeOn) {
    return <PricingPlansDialog feature={feature} source={source} />;
  }

  return <PlansDialog feature={feature} source={source} />;
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

const PlansDialog = ({
  feature,
  source,
}: {
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const [usage, setUsage] = useState<UsageOption>("commercial");
  const [paymentType, setPaymentType] = useState<PaymentType>("yearly");
  const [hasSeenHint, setSeenHint] = useState<boolean>(false);
  const userTracking = useUserTracking();

  const usageOptions = useMemo(
    () => [
      { label: translate("commercialUse"), value: "commercial" },
      { label: translate("nonCommercialUse"), value: "non-commercial" },
    ],
    [translate],
  );

  const handleUsageChange = (newUsage: UsageOption) => {
    userTracking.capture({ name: "planUsage.toggled" });
    if (newUsage === "non-commercial") {
      setPaymentType("yearly");
    }
    setSeenHint(true);
    setUsage(newUsage);
  };

  const handlePaymentToggle = () => {
    userTracking.capture({ name: "planPaymentType.toggled" });
    paymentType === "yearly"
      ? setPaymentType("monthly")
      : setPaymentType("yearly");
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
    >
      <div className="p-4">
        <div className="flex gap-4 flex-col flex-wrap md:flex-row items-start md:items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <div className="text-size-base text-default">
              {translate("for")}:
            </div>
            <Selector
              options={usageOptions}
              selected={usage}
              onChange={(value) => handleUsageChange(value as UsageOption)}
              ariaLabel={"usage"}
            />
            {usage === "commercial" && !hasSeenHint && <NonCommercialHint />}
            {(usage !== "commercial" || hasSeenHint) && (
              <div className="h-[48px]" />
            )}
          </div>
          <div
            className={`flex items-center gap-2 text-default ${usage === "non-commercial" ? "opacity-25" : ""}`}
          >
            <div className="text-size-base">{translate("monthly")}</div>
            <StyledSwitch
              checked={paymentType === "yearly"}
              disabled={usage === "non-commercial"}
              onCheckedChange={handlePaymentToggle}
            >
              <StyledThumb />
            </StyledSwitch>
            <div className="text-size-base">
              {translate("yearlyWithDiscount", "16")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mx-auto">
          <FreePlan paymentType={paymentType} />
          {usage === "commercial" && (
            <>
              <ProPlan
                paymentType={paymentType}
                feature={feature}
                source={source}
              />
              <TeamsPlan
                paymentType={paymentType}
                feature={feature}
                source={source}
              />
            </>
          )}
          {usage === "non-commercial" && (
            <>
              <PersonalPlan
                paymentType={paymentType}
                feature={feature}
                source={source}
              />
              <EducationPlan paymentType={paymentType} />
            </>
          )}
        </div>
      </div>
    </BaseDialog>
  );
};

const FreePlan = ({ paymentType }: { paymentType: PaymentType }) => {
  const translate = useTranslate();
  return (
    <div className="bg-base border rounded-md shadow-md overflow-hidden flex flex-col justify-between">
      <div className="p-6 grid max-xs:block md:flex md:flex-col grid-cols-2 gap-4 flex-1">
        <PlanHeader
          name="Free"
          price="$0"
          claim={translate("free.forEveryone")}
          payment={paymentType}
        />
        <FeaturesList
          items={[
            {
              feature: translate("free.webBasedEpanet"),
              Icon: CheckIcon,
              iconColor: "text-success",
            },
            {
              feature: translate("legacyModelBuilder"),
              Icon: CheckIcon,
              iconColor: "text-success",
              tooltip: translate("modelBuilderInfo"),
            },
            {
              feature: translate("free.backgroundMap"),
              Icon: CheckIcon,
              iconColor: "text-success",
            },
            {
              feature: translate("free.elevations"),
              Icon: CheckIcon,
              iconColor: "text-success",
            },
            {
              feature: translate("free.noLimits"),
              Icon: CheckIcon,
              iconColor: "text-success",
            },
            {
              feature: translate("free.communitySupport"),
              Icon: CheckIcon,
              iconColor: "text-success",
            },
          ]}
        />
      </div>
      <div className="p-4 w-full">
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

const PersonalPlan = ({
  paymentType,
  feature,
  source,
}: {
  paymentType: PaymentType;
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const isScriptingOn = useFeatureFlag("FLAG_SCRIPTING");
  const price = prices.personal.yearly;

  return (
    <div className="relative bg-base border border-purple-100 rounded-lg shadow-md shadow-purple-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6 grid max-xs:block md:flex md:flex-col grid-cols-2 gap-4 flex-1">
        <div className="absolute top-0 right-0 bg-linear-to-br from-purple-300 via-purple-400 to-purple-500 text-white text-size-small font-semibold py-1 px-2 rounded-bl-lg">
          {translate("mostPopular")}
        </div>
        <PlanHeader
          name="Personal"
          price={price}
          claim={translate("tryItYourself")}
          payment={paymentType}
        />
        <div className="flex flex-col justify-between flex-1">
          <FeaturesList
            title={translate("everythingAnd", "Free")}
            items={[
              {
                feature: translate("scenariosItem"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
              {
                feature: translate("proModelBuilder"),
                Icon: CloseIcon,
                iconColor: "text-red-500",
                tooltip: translate("modelBuilderInfo"),
              },
              {
                feature: translate("professionalSupport"),
                Icon: CloseIcon,
                iconColor: "text-red-500",
              },
              {
                feature: translate("customAttributesItem"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
              ...(isScriptingOn
                ? [
                    {
                      feature: translate("scriptingItem"),
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                  ]
                : []),
              {
                feature: translate("customMapLayers"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
              {
                feature: translate("customElevations"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
            ]}
          />
          <FeaturesList
            title={`${translate("comingSoon")}:`}
            textColor="text-subtle"
            items={[
              {
                feature: translate("cloudStorage"),
                Icon: CheckIcon,
                iconColor: "text-subtle",
              },
              {
                feature: translate("pointInTimeRestore", "30"),
                Icon: CheckIcon,
                iconColor: "text-subtle",
              },
              {
                feature: translate("demandsAnalysis"),
                Icon: CheckIcon,
                iconColor: "text-subtle",
              },
            ]}
          />
        </div>
      </div>
      <div className="p-4 w-full">
        <CheckoutButton
          plan="personal"
          paymentType={paymentType}
          feature={feature}
          source={source}
        >
          {translate("upgradeTo", "Personal")}
        </CheckoutButton>
      </div>
    </div>
  );
};

const EducationPlan = ({ paymentType }: { paymentType: PaymentType }) => {
  const translate = useTranslate();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { isSignedIn, signOut } = useAuth();
  const userTracking = useUserTracking();

  return (
    <div className="relative bg-base border rounded-lg shadow-md shadow-gray-300 overflow-hidden flex flex-col h-fit">
      <div className="p-6 grid max-xs:block md:flex md:flex-col grid-cols-2 gap-4 flex-1">
        <PlanHeader
          name="Education"
          price="$0"
          payment={paymentType}
          claim={translate("learnWithEpanetJS")}
        />
        <FeaturesList
          title={translate("everythingInForFree", "Personal")}
          items={[]}
        />
      </div>
      <div className="flex flex-col p-4 gap-y-3">
        <div className="w-full">
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
        </div>
        <div className="text-size-small text-center text-subtle">
          <p>{translate("havingIssuesWithStudentEmail")}</p>
          <a
            className="text-info"
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

const ProPlan = ({
  paymentType,
  feature,
  source,
}: {
  paymentType: PaymentType;
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const isScriptingOn = useFeatureFlag("FLAG_SCRIPTING");
  const price = prices.pro[paymentType];
  const { user, isSignedIn } = useAuth();
  const isTrialEmailRefused = useIsTrialEmailRefused();
  const canStartTrial =
    paymentType === "yearly" &&
    !!isSignedIn &&
    !user.hasUsedTrial &&
    !isTrialEmailRefused;

  return (
    <div className="relative bg-base border border-purple-100 rounded-lg shadow-md shadow-purple-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6 grid max-xs:block md:flex md:flex-col grid-cols-2 gap-4 flex-1">
        <div className="absolute top-0 right-0 bg-linear-to-br from-purple-300 via-purple-400 to-purple-500 text-white text-size-small font-semibold py-1 px-2 rounded-bl-lg">
          {translate("mostPopular")}
        </div>
        <PlanHeader
          name="Pro"
          price={price}
          payment={paymentType}
          claim={translate("upgradeToProFor")}
          subtitle={translate("namedLicence")}
        />
        <div className="flex flex-col justify-between flex-1">
          <FeaturesList
            title={translate("everythingAnd", "Free")}
            items={[
              {
                feature: translate("scenariosItem"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
              {
                feature: translate("proModelBuilder"),
                Icon: CheckIcon,
                iconColor: "text-success",
                tooltip: translate("modelBuilderInfo"),
              },
              {
                feature: translate("professionalSupport"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
              {
                feature: translate("customAttributesItem"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
              ...(isScriptingOn
                ? [
                    {
                      feature: translate("scriptingItem"),
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                  ]
                : []),
              {
                feature: translate("customMapLayers"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
              {
                feature: translate("customElevations"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
            ]}
          />
          <FeaturesList
            title={`${translate("comingSoon")}:`}
            textColor="text-subtle"
            items={[
              {
                feature: translate("cloudStorage"),
                Icon: CheckIcon,
                iconColor: "text-subtle",
              },
              {
                feature: translate("pointInTimeRestore", "30"),
                Icon: CheckIcon,
                iconColor: "text-subtle",
              },
              {
                feature: translate("demandsAnalysis"),
                Icon: CheckIcon,
                iconColor: "text-subtle",
              },
            ]}
          />
        </div>
      </div>
      <div className="p-4 w-full">
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
      </div>
    </div>
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

const TeamsPlan = ({
  paymentType,
  feature,
  source,
}: {
  paymentType: PaymentType;
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const basePrice =
    paymentType === "yearly"
      ? prices.teams.baseYearly
      : prices.teams.baseMonthly;
  const userPrice =
    paymentType === "yearly"
      ? prices.teams.userYearly
      : prices.teams.userMonthly;

  const goToTeamsRequestForm = () => {
    userTracking.capture({ name: "teamsRequest.clicked" });
    userTracking.capture({
      name: "checkout.started",
      plan: "teams",
      paymentType,
      source,
      sourceFeature: feature,
    });
    window.open(teamsPlanRequestFormUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative bg-base border rounded-md shadow-md shadow-gray-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6 grid max-xs:block md:flex md:flex-col grid-cols-2 gap-4 flex-1">
        <PlanHeader
          name="Teams"
          payment={paymentType}
          claim={translate("upgradeToTeamsFor")}
          basePrice={basePrice}
          userPrice={userPrice}
        />
        <div className="flex flex-col justify-between flex-1">
          <FeaturesList
            title={translate("everythingAnd", "Pro")}
            items={[
              {
                feature: translate("prioritySupport"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
              {
                feature: translate("selfServiceSeatManagement"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
              {
                feature: translate("payByInvoice"),
                Icon: CheckIcon,
                iconColor: "text-success",
              },
            ]}
          />
          <FeaturesList
            title={`${translate("comingSoon")}:`}
            textColor="text-subtle"
            items={[
              {
                feature: translate("teamStorage"),
                Icon: CheckIcon,
                iconColor: "text-subtle",
              },
              {
                feature: translate("pointInTimeRestore", "90"),
                Icon: CheckIcon,
                iconColor: "text-subtle",
              },
              {
                feature: translate("sharingModels"),
                Icon: CheckIcon,
                iconColor: "text-subtle",
              },
            ]}
          />
        </div>
      </div>
      <div className="p-4 w-full">
        <Button
          size="full-width"
          className="default-pointer bg-panel text-default"
          onClick={goToTeamsRequestForm}
        >
          {translate("requestQuote")}
        </Button>
      </div>
    </div>
  );
};

type PlanHeaderProps = {
  name: string;
  payment: PaymentType;
  claim: string;
} & (
  | { price: string; subtitle?: string; basePrice?: never; userPrice?: never }
  | { basePrice: string; userPrice: string; price?: never; subtitle?: never }
);

const PlanHeader = ({
  name,
  payment = "yearly",
  claim,
  ...props
}: PlanHeaderProps) => {
  const translate = useTranslate();
  const recurrency =
    payment === "yearly"
      ? `/${translate("yearShort")}`
      : `/${translate("monthShort")}`;

  return (
    <div className="flex flex-col">
      <h2 className="text-size-heading-2 font-semibold mb-2">{name}</h2>
      <p className="text-subtle text-size-base mb-4">{claim}</p>
      {"basePrice" in props ? (
        <div className="flex items-baseline gap-4">
          <div>
            <div className="mb-1">
              <strong className="text-3xl font-bold">{props.basePrice}</strong>
              <span className="text-size-base text-subtle">{recurrency}</span>
            </div>
            <p className="text-subtle text-size-base">
              {translate("baseCost")}
            </p>
          </div>
          <div className="flex gap-1">
            <span className="text-size-heading-2 font-bold text-default self-start">
              +
            </span>
            <div>
              <div className="mb-1">
                <strong className="text-size-heading-2 font-bold">
                  {props.userPrice}
                </strong>
                <span className="text-size-base text-subtle">{recurrency}</span>
              </div>
              <div className="flex items-center gap-1">
                <p className="text-subtle text-size-base">
                  {translate("perUser")}
                </p>
                <InfoTooltip text={translate("minimumTwoLicenses")} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-1">
            <strong className="text-3xl font-bold">{props.price}</strong>
            <span className="text-size-base text-subtle">{recurrency}</span>
          </div>
          <p className="text-subtle text-size-base">
            {props.subtitle ?? "\u00A0"}
          </p>
        </>
      )}
    </div>
  );
};

type SlottableIcon =
  | React.FC<React.ComponentProps<"svg">>
  | ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

export const FeaturesList = ({
  title,
  textColor = "text-default",
  items,
}: {
  title?: string;
  textColor?: string;
  items: {
    feature: string;
    Icon: SlottableIcon;
    iconColor: string;
    tooltip?: string;
  }[];
}) => {
  return (
    <div className="my-4">
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

const NonCommercialHint = () => {
  const translate = useTranslate();
  return (
    <div className="hidden sm:flex relative items-center ml-4 lg:ml-6 text-subtle font-handwritten text-size-heading-2 whitespace-nowrap">
      <svg
        width="48"
        height="218"
        viewBox="0 0 48 218"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="rotate-70 w-8 h-12 ml-2 mr-3"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M43.6953 0.553886C43.2025 1.04659 43.1086 1.32814 43.1086 2.64201C43.1086 3.6978 43.2729 4.54243 43.6484 5.41053C44.1412 6.63055 44.1647 6.84171 44.1412 14.8657C44.1178 23.4294 43.9535 28.0514 42.9913 45.601C41.7006 68.8753 40.668 81.0521 38.7671 95.3404C36.8193 110.075 32.6656 130.745 29.1219 143.555C26.6344 152.447 19.9696 172.765 16.9422 180.601C14.1496 187.828 9.92543 196.72 8.35309 198.691L7.88374 199.277L8.02454 196.227C8.30615 190.197 8.23576 173.727 7.93068 173.187C7.60213 172.53 6.49915 171.944 5.65432 171.944C4.66868 171.944 3.54224 173.234 3.23716 174.759C3.09635 175.463 2.86167 179.264 2.74433 183.206C2.36885 195.101 1.89949 200.849 0.749579 207.723C-0.165658 213.19 -0.21259 214.316 0.444503 215.56C1.2424 217.085 1.99337 217.554 3.87078 217.648C5.11457 217.718 5.84206 217.624 7.27359 217.132C9.69075 216.311 15.5811 213.472 22.6683 209.694C32.3839 204.509 31.9381 204.791 31.3983 204.251C30.8116 203.665 19.2655 206.527 11.1692 209.272C8.89285 210.023 6.96851 210.656 6.87464 210.656C6.80423 210.656 6.73382 210.304 6.73382 209.882C6.73382 209.295 7.08585 208.709 8.28269 207.254C14.9475 199.136 19.5706 189.165 26.6344 167.721C33.4165 147.121 35.599 138.98 39.0018 121.266C44.1412 94.6131 46.136 73.0281 47.1451 33.0957C47.3563 24.4148 47.3563 20.3793 47.1216 15.0065C46.6757 4.16704 46.2768 1.11697 45.1738 0.319265C44.4698 -0.149975 44.3524 -0.126513 43.6953 0.553886Z"
          fill="currentColor"
        />
      </svg>
      <span className="-mt-4">{translate("studentOrPersonal")}</span>
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

const PricingPlansDialog = ({
  feature,
  source,
}: {
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { closeDialog } = useDialogState();
  const { user, isSignedIn } = useAuth();
  const isTrialEmailRefused = useIsTrialEmailRefused();
  const isTrialAvailable =
    !!isSignedIn && !user.hasUsedTrial && !isTrialEmailRefused;
  const [usage, setUsage] = useState<UsageOption>("commercial");

  const handleUsageChange = (newUsage: UsageOption) => {
    userTracking.capture({ name: "planUsage.toggled" });
    setUsage(newUsage);
  };

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
            <p className="text-subtle">
              {translate("pricingPlans.studentOrPersonal")}{" "}
              <button
                type="button"
                className="inline-flex items-center gap-1 text-info hover:underline"
                onClick={() => handleUsageChange("non-commercial")}
              >
                {translate("pricingPlans.nonCommercialLicenses")}
                <ArrowRightIcon />
              </button>
            </p>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-info hover:underline"
              onClick={() => handleUsageChange("commercial")}
            >
              <ArrowLeftIcon />
              {translate("pricingPlans.backToCommercial")}
            </button>
          )}
          <p className="text-subtle">
            {translate("pricingPlans.haveQuestions")}{" "}
            <a className="text-info" href="mailto:sales@epanetjs.com">
              {translate("pricingPlans.sendEmail")}
            </a>{" "}
            {translate("pricingPlans.or")}{" "}
            <a
              className="text-info"
              target="_blank"
              href="https://cal.com/epanet-js/"
            >
              {translate("pricingPlans.bookCall")}
            </a>
            .
          </p>
        </footer>
      }
    >
      <div className="p-4">
        {/* Both views share one grid cell, so the dialog keeps the taller one's height. */}
        <div className="grid">
          <div
            aria-hidden={usage !== "commercial"}
            className={clsx(
              "[grid-area:1/1] flex flex-col gap-4",
              usage !== "commercial" && "invisible",
            )}
          >
            {isTrialAvailable && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 p-4 text-center text-size-base text-default">
                <ClockIcon className="text-blue-600" />
                <p>
                  <strong className="font-semibold">
                    {translate("pricingPlans.trialTitle")}
                  </strong>{" "}
                  {translate("pricingPlans.trialDescription")}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ProPricingCard
                feature={feature}
                source={source}
                isTrialAvailable={isTrialAvailable}
              />
              <UltimatePricingCard feature={feature} source={source} />
              <EnterprisePricingCard />
            </div>
          </div>
          <div
            aria-hidden={usage !== "non-commercial"}
            className={clsx(
              "[grid-area:1/1]",
              usage !== "non-commercial" && "invisible",
            )}
          >
            <NonCommercialLicenses feature={feature} source={source} />
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};

const ProPricingCard = ({
  feature,
  source,
  isTrialAvailable,
}: {
  feature: string;
  source: UpgradeOrigin;
  isTrialAvailable: boolean;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const [paymentType, setPaymentType] = useState<PaymentType>("yearly");
  const canStartTrial = paymentType === "yearly" && isTrialAvailable;

  const handlePaymentChange = (newPaymentType: PaymentType) => {
    userTracking.capture({ name: "planPaymentType.toggled" });
    setPaymentType(newPaymentType);
  };

  return (
    <PricingCard
      name="Pro"
      per={translate("pricingPlans.pro.per")}
      featured
      price={
        <>
          <PricingAmount>{proPrices[paymentType]}</PricingAmount>
          <BillingPeriodSelect
            value={paymentType}
            onChange={handlePaymentChange}
          />
        </>
      }
      featuresTitle={`${translate("everythingAnd", "Free")}:`}
      features={[
        { label: translate("scenariosItem") },
        {
          label: translate("proModelBuilder"),
          tooltip: translate("pricingPlans.pro.modelBuilderInfo"),
        },
        { label: translate("customAttributesItem") },
        { label: translate("pricingPlans.pro.customMapLayers") },
        { label: translate("scriptingItem") },
        { label: translate("professionalSupport") },
      ]}
      more={
        <p className="mt-2 text-size-base text-subtle">
          {translate("pricingPlans.pro.andMore")}
        </p>
      }
      actions={
        <>
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
          <QuoteButton label={translate("pricingPlans.requestQuote")} />
        </>
      }
    />
  );
};

const UltimatePricingCard = ({
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
    <PricingCard
      name="Ultimate"
      per={translate("pricingPlans.ultimate.per", "3")}
      isPerStrong
      price={
        <>
          <PricingAmount>$10,000</PricingAmount>
          <span className="ml-1 text-size-base text-subtle">
            {translate("pricingPlans.perYear")}
          </span>
        </>
      }
      featuresTitle={`${translate("everythingAnd", "Pro")}:`}
      features={[
        { label: translate("pricingPlans.ultimate.sharedCloudModels") },
        { label: translate("pricingPlans.ultimate.teamBranching") },
        { label: translate("pricingPlans.ultimate.rolesAndPermissions") },
        { label: translate("selfServiceSeatManagement") },
        { label: translate("payByInvoice") },
        { label: translate("pricingPlans.ultimate.teamOnboarding") },
      ]}
      extraFeaturesTitle={translate("pricingPlans.ultimate.advancedWorkflows")}
      extraFeatures={[
        {
          label: translate("pricingPlans.ultimate.automatedModelBuild"),
          Icon: HammerIcon,
        },
        {
          label: translate("pricingPlans.ultimate.calibrationTools"),
          Icon: SlidersHorizontalIcon,
        },
        {
          label: translate("pricingPlans.ultimate.unlimitedConversions"),
          Icon: InfiniteIcon,
        },
        {
          label: translate("pricingPlans.ultimate.shutdownsAndInquiries"),
          Icon: GaugeIcon,
        },
        {
          label: translate("pricingPlans.ultimate.aiAssistedModeling"),
          Icon: BotIcon,
        },
      ]}
      actions={
        <QuoteButton
          label={translate("pricingPlans.requestQuote")}
          onClick={captureCheckoutStarted}
        />
      }
    />
  );
};

const EnterprisePricingCard = () => {
  const translate = useTranslate();

  return (
    <PricingCard
      name="Enterprise"
      per={translate("pricingPlans.enterprise.per")}
      price={
        <PricingAmount>
          {translate("pricingPlans.enterprise.price")}
        </PricingAmount>
      }
      featuresTitle={`${translate("everythingAnd", "Ultimate")}:`}
      features={[
        { label: translate("pricingPlans.enterprise.corporateSso") },
        { label: translate("pricingPlans.enterprise.regionalHosting") },
        {
          label: translate("pricingPlans.enterprise.centralizedUserManagement"),
        },
        { label: translate("pricingPlans.enterprise.networkPermissions") },
        { label: translate("pricingPlans.enterprise.securityReview") },
        { label: translate("pricingPlans.enterprise.dedicatedSupport") },
      ]}
      actions={
        <QuoteButton label={translate("pricingPlans.enterprise.contactUs")} />
      }
    />
  );
};

type PricingFeature = {
  label: string;
  Icon?: SlottableIcon;
  tooltip?: string;
};

const PricingCard = ({
  name,
  per,
  isPerStrong = false,
  featured = false,
  price,
  featuresTitle,
  features,
  extraFeaturesTitle,
  extraFeatures,
  more,
  actions,
}: {
  name: string;
  per: string;
  isPerStrong?: boolean;
  featured?: boolean;
  price: ReactNode;
  featuresTitle: string;
  features: PricingFeature[];
  extraFeaturesTitle?: string;
  extraFeatures?: PricingFeature[];
  more?: ReactNode;
  actions: ReactNode;
}) => {
  return (
    <div
      className={clsx(
        "flex flex-col bg-base border rounded-lg p-6",
        featured
          ? "border-purple-200 shadow-[0_4px_12px_rgba(124,58,237,0.10),0_16px_40px_rgba(124,58,237,0.18)]"
          : "shadow-md shadow-gray-300",
      )}
    >
      <h3 className="text-size-heading-2 font-semibold">{name}</h3>
      <div className="mt-2">
        <span
          className={clsx(
            "block text-size-base",
            isPerStrong ? "font-semibold text-default" : "text-subtle",
          )}
        >
          {per}
        </span>
        {price}
      </div>
      <div className="mt-4 flex flex-1 flex-col">
        <p className="text-size-small font-semibold uppercase tracking-wide text-subtle">
          {featuresTitle}
        </p>
        <PricingFeatureList items={features} />
        {extraFeatures && (
          <>
            <p className="mt-2 text-size-base text-subtle">
              {extraFeaturesTitle}
            </p>
            <PricingFeatureList items={extraFeatures} />
          </>
        )}
        {more}
        <div className="mt-auto pt-4 flex flex-col gap-2">{actions}</div>
      </div>
    </div>
  );
};

const PricingAmount = ({ children }: { children: ReactNode }) => {
  return <strong className="text-3xl font-bold">{children}</strong>;
};

const PricingFeatureList = ({ items }: { items: PricingFeature[] }) => {
  return (
    <ul className="mt-1 space-y-1">
      {items.map(({ label, Icon = CheckIcon, tooltip }) => (
        <li
          key={label}
          className="flex items-start gap-2 text-size-base text-default"
        >
          <Icon className="mt-0.5 shrink-0 text-indigo-500" />
          <span>{label}</span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </li>
      ))}
    </ul>
  );
};

const BillingPeriodSelect = ({
  value,
  onChange,
}: {
  value: PaymentType;
  onChange: (value: PaymentType) => void;
}) => {
  const translate = useTranslate();
  const labels: Record<PaymentType, string> = {
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
    window.open(teamsPlanRequestFormUrl, "_blank", "noopener,noreferrer");
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

const NonCommercialLicenses = ({
  feature,
  source,
}: {
  feature: string;
  source: UpgradeOrigin;
}) => {
  const translate = useTranslate();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { isSignedIn, signOut } = useAuth();
  const { startCheckout } = useCheckout();
  const userTracking = useUserTracking();

  const startStudentSignUp = () => {
    userTracking.capture({ name: "studentLogin.clicked" });
    checkUnsavedChanges(() => {
      if (isSignedIn) {
        void signOut({ redirectUrl: signUpUrl });
      } else {
        window.location.href = signUpUrl;
      }
    });
  };

  const startPersonalCheckout = () => {
    userTracking.capture({
      name: "checkout.started",
      plan: "personal",
      paymentType: "yearly",
      source,
      sourceFeature: feature,
    });
    startCheckout("personal", "yearly");
  };

  return (
    <section>
      <h2 className="text-size-heading-2 font-semibold">
        {translate("pricingPlans.nonCommercialLicenses")}
      </h2>
      <p className="text-size-base text-subtle">
        {translate("pricingPlans.nonCommercial.description")}
      </p>
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <NonCommercialLicense
          Icon={GraduationCapIcon}
          name="Education"
          description={translate(
            "pricingPlans.nonCommercial.educationDescription",
          )}
          price={translate("pricingPlans.nonCommercial.educationPrice")}
          per={translate("pricingPlans.nonCommercial.educationPer")}
          onClick={startStudentSignUp}
          help={
            <>
              {translate("havingIssuesWithStudentEmail")}{" "}
              <a
                className="text-info"
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
            </>
          }
        />
        <NonCommercialLicense
          Icon={UserIcon}
          name="Personal"
          description={translate(
            "pricingPlans.nonCommercial.personalDescription",
          )}
          price="$100"
          per={translate("pricingPlans.perYear")}
          onClick={startPersonalCheckout}
        />
      </div>
    </section>
  );
};

const NonCommercialLicense = ({
  Icon,
  name,
  description,
  price,
  per,
  onClick,
  help,
}: {
  Icon: SlottableIcon;
  name: string;
  description: string;
  price: string;
  per: string;
  onClick: () => void;
  help?: ReactNode;
}) => {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col gap-4 rounded-lg border bg-base shadow-sm p-6 text-left hover:bg-base-hover"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-100 to-purple-100 text-purple-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <span className="block text-size-base font-semibold text-default">
            {name}
          </span>
          <span className="block text-size-base text-subtle">
            {description}
          </span>
          <span className="flex items-baseline mt-2">
            <strong className="text-2xl font-bold text-default">{price}</strong>
            <span className="ml-1 text-size-base text-subtle">{per}</span>
          </span>
        </div>
      </button>
      {help && <p className="text-size-base text-subtle">{help}</p>}
    </div>
  );
};
