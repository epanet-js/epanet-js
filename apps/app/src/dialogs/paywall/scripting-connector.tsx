import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

// PLACEHOLDER: the custom-layers recording. Replace with the scripting one.
const SCRIPTING_VIDEO_SRC =
  "https://stream.mux.com/edP01XlZ2kgSvviQMj1jTnxc8NGy1qtfAPAsoyZdJcug.m3u8";

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
