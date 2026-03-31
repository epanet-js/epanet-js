import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

const CUSTOM_LAYERS_VIDEO_SRC =
  "https://stream.mux.com/placeholder-custom-layers-video.m3u8";

const CUSTOM_LAYERS_CAPTIONS = [
  { start: 0.316, end: 4.033, captionKey: "customLayers.paywall.captions.1" },
  { start: 5.0, end: 10.849, captionKey: "customLayers.paywall.captions.2" },
  {
    start: 11.849,
    end: 16.566,
    captionKey: "customLayers.paywall.captions.3",
  },
] as const;

export const CustomLayersPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "customLayers",
    videoSrc: CUSTOM_LAYERS_VIDEO_SRC,
    captions: CUSTOM_LAYERS_CAPTIONS,
    titleKey: "customLayers.paywall.title",
    descriptionKeys: [
      "customLayers.paywall.description1",
      "customLayers.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "customLayers.paywall.trial",
      plans: "customLayers.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
