import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

const SCRIPTING_VIDEO_SRC =
  "https://stream.mux.com/02TFqsbNdcoxx00HKCQK4kmZUEXM7sUcQSap100JRFIlTU.m3u8";

const SCRIPTING_CAPTIONS = [
  { start: 0.0, end: 4.8, captionKey: "scripting.paywall.captions.1" },
  { start: 4.8, end: 11.2, captionKey: "scripting.paywall.captions.2" },
  { start: 11.2, end: 16.7, captionKey: "scripting.paywall.captions.3" },
] as const;

export const ScriptingPaywallConnector = ({
  feature,
  onClose,
}: {
  feature: "runScripts" | "editScripts";
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature,
    videoSrc: SCRIPTING_VIDEO_SRC,
    captions: SCRIPTING_CAPTIONS,
    titleKey: "scripting.paywall.title",
    descriptionKeys: [
      "scripting.paywall.description1",
      "scripting.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "scripting.paywall.trial",
      plans: "scripting.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
