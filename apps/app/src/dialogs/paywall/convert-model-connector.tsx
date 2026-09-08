import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

// PLACEHOLDER: the custom-layers recording. Replace with the convert-model one.
const CONVERT_MODEL_VIDEO_SRC =
  "https://stream.mux.com/edP01XlZ2kgSvviQMj1jTnxc8NGy1qtfAPAsoyZdJcug.m3u8";

const CONVERT_MODEL_CAPTIONS = [
  { start: 0.316, end: 4.033, captionKey: "convertModel.paywall.captions.1" },
  { start: 5.0, end: 10.849, captionKey: "convertModel.paywall.captions.2" },
  {
    start: 11.849,
    end: 16.566,
    captionKey: "convertModel.paywall.captions.3",
  },
] as const;

export const ConvertModelPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "convertModel",
    videoSrc: CONVERT_MODEL_VIDEO_SRC,
    captions: CONVERT_MODEL_CAPTIONS,
    titleKey: "convertModel.paywall.title",
    descriptionKeys: [
      "convertModel.paywall.description1",
      "convertModel.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "convertModel.paywall.trial",
      plans: "convertModel.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
