import { useTranslate } from "src/hooks/use-translate";
import { ConnectIcon } from "src/icons";
import { FixButton } from "./fix-button";

export const FixProximityAnomalyButton = ({ onFix }: { onFix: () => void }) => {
  const translate = useTranslate();

  return (
    <FixButton
      label={translate("connect")}
      icon={<ConnectIcon size="md" />}
      onFix={onFix}
    />
  );
};
