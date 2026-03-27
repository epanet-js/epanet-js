import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

const ELEVATIONS_VIDEO_SRC =
  "https://stream.mux.com/RVxWPZgcfKowXmi00iovKx1sffG100gu21BpD2U6Mjv98.m3u8";

const ELEVATIONS_CAPTIONS = [
  { start: 0.283, end: 3.283, captionKey: "elevations.paywall.captions.1" },
  { start: 4.933, end: 10.616, captionKey: "elevations.paywall.captions.2" },
  { start: 12.066, end: 17.0, captionKey: "elevations.paywall.captions.3" },
  { start: 19.933, end: 25.4, captionKey: "elevations.paywall.captions.4" },
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
