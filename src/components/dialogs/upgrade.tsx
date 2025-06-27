import { DialogContainer, DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import {
  CheckIcon,
  Cross1Icon,
  CrossCircledIcon,
  InfoCircledIcon,
  RocketIcon,
} from "@radix-ui/react-icons";
import {
  CheckoutButton,
  PaymentType,
  clearCheckoutParams,
  getCheckoutUrlParams,
  startCheckout,
} from "../checkout-button";
import { Button, StyledSwitch, StyledThumb } from "../elements";
import {
  ForwardRefExoticComponent,
  RefAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";
import { IconProps } from "@radix-ui/react-icons/dist/types";
import { Selector } from "../form/selector";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useUserTracking } from "src/infra/user-tracking";
import { studentAccountActiviationHelpUrl } from "src/global-config";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { useAuth } from "src/auth";
import { notify } from "../notifications";
import { captureError } from "src/infra/error-tracking";

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
    monthly: "$250",
    yearly: "$2500",
  },
};

export const UpgradeDialog = () => {
  const [usage, setUsage] = useState<UsageOption>("commercial");
  const [paymentType, setPaymentType] = useState<PaymentType>("yearly");
  const [hasSeenHint, setSeenHint] = useState<boolean>(false);
  const userTracking = useUserTracking();

  useEffect(() => {
    const checkoutParams = getCheckoutUrlParams();
    if (!checkoutParams.enabled) return;

    clearCheckoutParams();
    try {
      void startCheckout(checkoutParams.plan, checkoutParams.paymentType);
    } catch (error) {
      captureError(error as Error);
      notify({
        variant: "error",
        title: translate("somethingWentWrong"),
        description: translate("tryAgainOrSupport"),
        Icon: CrossCircledIcon,
      });
    }
  }, []);

  const usageOptions = useMemo(
    () => [
      { label: translate("commercialUse"), value: "commercial" },
      { label: translate("nonCommercialUse"), value: "non-commercial" },
    ],
    [],
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

  return (
    <DialogContainer size="lg">
      <DialogHeader
        title={translate("upgradeYourAccount")}
        titleIcon={RocketIcon}
      />
      <label className="block py-4 gap-4 flex flex-col flex-wrap md:flex-row items-start md:items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-700 dark:text-gray-300">
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
          className={`flex items-center gap-2 text-gray-700 ${usage === "non-commercial" ? "opacity-25" : ""}`}
        >
          <div className="text-sm ">{translate("monthly")}</div>
          <StyledSwitch
            checked={paymentType === "yearly"}
            disabled={usage === "non-commercial"}
            onCheckedChange={handlePaymentToggle}
          >
            <StyledThumb />
          </StyledSwitch>
          <div className="text-sm ">
            {translate("yearlyWithDiscount", "16")}
          </div>
        </div>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mx-auto">
        <FreePlan paymentType={paymentType} />
        {usage === "commercial" && (
          <>
            <ProPlan paymentType={paymentType} />
            <TeamsPlan paymentType={paymentType} />
          </>
        )}
        {usage === "non-commercial" && (
          <>
            <PersonalPlan paymentType={paymentType} />
            <EducationPlan paymentType={paymentType} />
          </>
        )}
      </div>
    </DialogContainer>
  );
};

const FreePlan = ({ paymentType }: { paymentType: PaymentType }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-md shadow-md overflow-hidden flex flex-col justify-between">
      <div className="p-6">
        <PlanHeader
          name="Free"
          price="$0"
          claim={translate("free.forBetterModelling")}
          payment={paymentType}
        />
        <FeaturesList
          items={[
            {
              feature: translate("free.webBasedEpanet"),
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: translate("free.backgroundMap"),
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: translate("free.elevations"),
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: translate("free.noLimits"),
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: translate("free.communitySupport"),
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
          ]}
        />
      </div>
      <div className="p-4 w-full">
        <Button
          size="full-width"
          className="default-pointer bg-gray-300 text-gray-700"
          disabled={true}
        >
          <CheckIcon className="h-5 w-5" />
          {translate("currentPlan")}
        </Button>
      </div>
    </div>
  );
};

const PersonalPlan = ({ paymentType }: { paymentType: PaymentType }) => {
  const price = prices.personal.yearly;

  return (
    <div className="relative bg-white border border-purple-100 rounded-lg shadow-md shadow-purple-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6">
        <div className="absolute top-0 right-0 bg-gradient-to-br from-purple-300 via-purple-400 to-purple-500 text-white text-xs font-semibold py-1 px-2 rounded-bl-lg">
          {translate("mostPopular")}
        </div>
        <PlanHeader
          name="Personal"
          price={price}
          claim={translate("tryItYourself")}
          payment={paymentType}
        />
        <FeaturesList
          title={translate("everythingAnd", "Free")}
          items={[
            {
              feature: translate("professionalSupport"),
              Icon: Cross1Icon,
              iconColor: "text-red-500",
            },
            {
              feature: translate("customMapLayers"),
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
          ]}
        />
        <div className="h-4"></div>
        <FeaturesList
          title={`${translate("comingSoon")}:`}
          textColor="text-gray-500"
          items={[
            {
              feature: translate("scenarios"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("cloudStorage"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("pointInTimeRestore", "30"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("demandsAnalysis"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("liveDataCompare"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
          ]}
        />
      </div>
      <div className="p-4 w-full">
        <CheckoutButton plan="personal" paymentType={paymentType}>
          {translate("upgradeTo", "Personal")}
        </CheckoutButton>
      </div>
    </div>
  );
};

const EducationPlan = ({ paymentType }: { paymentType: PaymentType }) => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { signOut } = useAuth();
  const userTracking = useUserTracking();

  return (
    <div className="relative bg-white border border-gray-100 rounded-lg shadow-md shadow-gray-300 overflow-hidden flex flex-col h-fit">
      <div className="p-6 pb-0">
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
            className="default-pointer bg-gray-100 text-gray-700"
            onClick={() => {
              userTracking.capture({ name: "studentLogin.clicked" });
              checkUnsavedChanges(() => {
                signOut({ redirectUrl: process.env.NEXT_PUBLIC_SIGN_UP_URL });
              });
            }}
          >
            {translate("useStudentEmail")}
          </Button>
        </div>
        <div className="text-xs text-center text-gray-500">
          <p>{translate("havingIssuesWithStudentEmail")}</p>
          <a
            className="text-blue-600"
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

const ProPlan = ({ paymentType }: { paymentType: PaymentType }) => {
  const price = prices.pro[paymentType];

  return (
    <div className="relative bg-white border border-purple-100 rounded-lg shadow-md shadow-purple-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6">
        <div className="absolute top-0 right-0 bg-gradient-to-br from-purple-300 via-purple-400 to-purple-500 text-white text-xs font-semibold py-1 px-2 rounded-bl-lg">
          {translate("mostPopular")}
        </div>
        <PlanHeader
          name="Pro"
          price={price}
          payment={paymentType}
          claim={translate("individualNamedLicense")}
        />
        <FeaturesList
          title={translate("everythingAnd", "Free")}
          items={[
            {
              feature: translate("professionalSupport"),
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: translate("customMapLayers"),
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
          ]}
        />
        <div className="h-4"></div>
        <FeaturesList
          title={`${translate("comingSoon")}:`}
          textColor="text-gray-500"
          items={[
            {
              feature: translate("scenarios"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("cloudStorage"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("pointInTimeRestore", "30"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("demandsAnalysis"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("liveDataCompare"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
          ]}
        />
      </div>
      <div className="p-4 w-full">
        <CheckoutButton plan="pro" paymentType={paymentType}>
          {translate("upgradeTo", "Pro")}
        </CheckoutButton>
      </div>
    </div>
  );
};

const TeamsPlan = ({ paymentType }: { paymentType: PaymentType }) => {
  const price = prices.teams[paymentType];

  return (
    <div className="relative bg-white border border-gray-200 rounded-md shadow-md shadow-gray-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6">
        <div className="absolute top-0 right-0 bg-gradient-to-br from-gray-300 via-purple-gray to-gray-500 text-white text-xs font-semibold py-1 px-2 rounded-bl-lg">
          {translate("comingSoon")}
        </div>
        <PlanHeader
          name="Teams"
          price={price}
          payment={paymentType}
          claim={translate("floatingSharedLicenses")}
          tooltip={translate("minimumTwoLicenses")}
        />
        <FeaturesList
          title={translate("everythingAnd", "Pro")}
          textColor="text-gray-500"
          items={[
            {
              feature: translate("prioritySupport"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("teamStorage"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("pointInTimeRestore", "90"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("sharingModels"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: translate("volumeDiscounts"),
              Icon: CheckIcon,
              iconColor: "text-gray-400",
            },
          ]}
        />
      </div>
      <div className="p-4 w-full">
        <Button size="full-width" variant="quiet" disabled={true}>
          {translate("comingSoon")}
        </Button>
      </div>
    </div>
  );
};

const PlanHeader = ({
  name,
  price,
  payment = "yearly",
  claim,
  tooltip,
}: {
  name: string;
  price: string;
  payment: PaymentType;
  claim: string;
  tooltip?: string;
}) => {
  const recurrency =
    payment === "yearly"
      ? `/${translate("year")}`
      : `/${translate("monthShort")}`;

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-semibold mb-2">{name}</h2>
      <div className="mb-1">
        <strong className="text-3xl font-bold">{price}</strong>
        <span className="text-lg text-gray-500">{recurrency}</span>
      </div>
      <div className="flex items-center mb-4 space-x-1">
        <p className="text-gray-600 text-sm">{claim}</p>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
    </div>
  );
};

type SlottableIcon =
  | React.FC<React.ComponentProps<"svg">>
  | ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

const FeaturesList = ({
  title,
  textColor = "text-gray-700",
  items,
}: {
  title?: string;
  textColor?: string;
  items: { feature: string; Icon: SlottableIcon; iconColor: string }[];
}) => {
  return (
    <div className="my-4">
      {title && <p className="text-sm text-gray-500 mb-2">{title}</p>}
      <ul className="space-y-2 flex-grow">
        {items.map(({ feature, Icon, iconColor }, index) => (
          <li key={index} className={`flex items-start text-sm ${textColor}`}>
            <Icon className={`h-5 w-5 ${iconColor} flex-shrink-0 mr-2`} />{" "}
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
};

const NonCommercialHint = () => {
  return (
    <div className="hidden sm:flex relative items-center ml-4 lg:ml-6 text-gray-400 font-handwritten text-xl whitespace-nowrap">
      <svg
        width="48"
        height="218"
        viewBox="0 0 48 218"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="rotate-[70deg]  w-8 h-12 ml-2 mr-3"
      >
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
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
    <Tooltip.Root delayDuration={100}>
      <Tooltip.Trigger asChild>
        <button className="p-1 rounded-full hover:bg-gray-200">
          <InfoCircledIcon className="w-5 h-5 text-gray-500" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg z-50"
          side="top"
          align="start"
        >
          {text}
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};
