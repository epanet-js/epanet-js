import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

export const ZonesPaywallConnector = ({ onClose }: { onClose: () => void }) => {
  const config: FeaturePaywallConfig = {
    feature: "zones",
    imageSrc: "/images/zone-overlay-paywall.webp",
    titleKey: "importZones.paywall.title",
    descriptionKeys: [
      "importZones.paywall.description1",
      "importZones.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "importZones.paywall.trial",
      plans: "importZones.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
