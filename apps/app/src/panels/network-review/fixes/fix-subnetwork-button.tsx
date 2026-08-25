import { useTranslate } from "src/hooks/use-translate";
import { DeactivateTopologyIcon } from "src/icons";
import { FixButton } from "./fix-button";

export const FixSubnetworkButton = ({ onFix }: { onFix: () => void }) => {
  const translate = useTranslate();

  return (
    <FixButton
      label={translate("deactivateAssets")}
      icon={<DeactivateTopologyIcon size="md" />}
      onFix={onFix}
    />
  );
};
