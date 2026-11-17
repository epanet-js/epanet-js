import { SensorsIcon } from "src/icons";
import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

export const SensorDataPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "sensorData",
    media: (
      <div className="w-full h-full flex items-center justify-center text-subtle">
        <SensorsIcon size="2xl" />
      </div>
    ),
    titleKey: "sensorData.paywall.title",
    descriptionKeys: [
      "sensorData.paywall.description1",
      "sensorData.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "sensorData.paywall.trial",
      plans: "sensorData.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
