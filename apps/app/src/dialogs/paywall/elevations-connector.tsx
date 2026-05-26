import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

const ELEVATIONS_VIDEO_SRC =
  "https://stream.mux.com/5lHcX2XaSIxl017ZNfXSlIifHTp2dpDzpO7ubGFhMyQI.m3u8";

const ELEVATIONS_CAPTIONS = [
  { start: 0.316, end: 4.033, captionKey: "elevations.paywall.captions.1" },
  { start: 5.0, end: 10.849, captionKey: "elevations.paywall.captions.2" },
  { start: 11.849, end: 16.566, captionKey: "elevations.paywall.captions.3" },
] as const;

export const ElevationsPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "elevations",
    videoSrc: ELEVATIONS_VIDEO_SRC,
    captions: ELEVATIONS_CAPTIONS,
    titleKey: "elevations.paywall.title",
    descriptionKeys: [
      "elevations.paywall.description1",
      "elevations.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "elevations.paywall.trial",
      plans: "elevations.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
