import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

export const PipeLibraryPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "pipeLibrary",
    imageSrc: "/images/pipe-library-paywall.webp",
    titleKey: "pipeLibrary.paywall.title",
    descriptionKeys: [
      "pipeLibrary.paywall.description1",
      "pipeLibrary.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "pipeLibrary.paywall.trial",
      plans: "pipeLibrary.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
