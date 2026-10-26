import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

const SCRIPTING_VIDEO_SRC =
  "https://stream.mux.com/WOoXicYR9m8HcZrpaVB8Oe3h9x01be2Ro6Prs22RZBKI.m3u8";

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
