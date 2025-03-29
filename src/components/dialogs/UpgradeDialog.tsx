import { DialogHeader } from "src/components/dialog";
import { translate } from "src/infra/i18n";
import { CheckIcon, RocketIcon, TimerIcon } from "@radix-ui/react-icons";
import { CheckoutButton } from "../checkout-button";
import { Button } from "../elements";
import { ForwardRefExoticComponent, RefAttributes } from "react";
import { IconProps } from "@radix-ui/react-icons/dist/types";

export const UpgradeDialog = () => {
  return (
    <>
      <DialogHeader
        title={translate("upgradeYourAccount")}
        titleIcon={RocketIcon}
      />
      <PricingGrid />
    </>
  );
};

const FreePlan = () => {
  return (
    <div className="bg-white border border-gray-100 rounded-md shadow-md overflow-hidden flex flex-col justify-between">
      <div className="p-6">
        <PlanHeader
          name="Free"
          price="$0"
          claim="For a better modeling experience"
        />
        <FeaturesList
          items={[
            {
              feature: "Web based EPANET model",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: "Background maps and satellite",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: "Automated elevations",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: "No limits on sizes",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: "Community support",
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
          Current plan
        </Button>
      </div>
    </div>
  );
};

const ProPlan = () => {
  return (
    <div className="relative bg-white border border-purple-100 rounded-lg shadow-md shadow-purple-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6">
        <div className="absolute top-0 right-0 bg-gradient-to-br from-purple-300 via-purple-400 to-purple-500 text-white text-xs font-semibold py-1 px-2 rounded-bl-lg">
          Most popular
        </div>
        <PlanHeader name="Pro" price="$90" claim="Individual named license" />
        <FeaturesList
          title="Everything in Free, and:"
          items={[
            {
              feature: "Professional support",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: "Custom map layers",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
          ]}
        />
        <div className="h-4"></div>
        <FeaturesList
          title="Coming soon:"
          textColor="text-gray-500"
          items={[
            {
              feature: "Scenarios",
              Icon: TimerIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: "Cloud storage",
              Icon: TimerIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: "Point in time restore (30 days)",
              Icon: TimerIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: "Demands analysis",
              Icon: TimerIcon,
              iconColor: "text-gray-400",
            },
            {
              feature: "Live data comparision",
              Icon: TimerIcon,
              iconColor: "text-gray-400",
            },
          ]}
        />
      </div>
      <div className="p-4 w-full">
        <CheckoutButton>Upgrade to Pro</CheckoutButton>
      </div>
    </div>
  );
};

const TeamsPlan = () => {
  return (
    <div className="relative bg-white border border-gray-200 rounded-md shadow-md shadow-gray-300 overflow-hidden flex flex-col justify-between">
      <div className="p-6">
        <div className="absolute top-0 right-0 bg-gradient-to-br from-gray-300 via-purple-gray to-gray-500 text-white text-xs font-semibold py-1 px-2 rounded-bl-lg">
          Coming soon
        </div>
        <PlanHeader name="Teams" price="$900" claim="Floating shared license" />
        <FeaturesList
          title="Everything in Pro, and:"
          items={[
            {
              feature: "Priority support",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: "Team storage",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: "Point in time restore (90 days)",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: "Sharing networks",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
            {
              feature: "Volume discounts",
              Icon: CheckIcon,
              iconColor: "text-green-500",
            },
          ]}
        />
      </div>
      <div className="p-4 w-full">
        <Button size="full-width" variant="quiet" disabled={true}>
          Coming soon
        </Button>
      </div>
    </div>
  );
};

const PricingGrid = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto p-4">
      <FreePlan />
      <ProPlan />
      <TeamsPlan />
    </div>
  );
};

const PlanHeader = ({
  name,
  price,
  claim,
}: {
  name: string;
  price: string;
  claim: string;
}) => {
  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-semibold mb-2">{name}</h2>
      <div className="mb-1">
        <strong className="text-3xl font-bold">{price}</strong>
        <span className="text-lg text-gray-500">/mo</span>
      </div>
      <p className="text-gray-600 text-sm mb-4">{claim}</p>
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
