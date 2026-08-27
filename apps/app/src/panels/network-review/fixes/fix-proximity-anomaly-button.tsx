import { useTranslate } from "src/hooks/use-translate";
import { ConnectToPipeIcon } from "src/icons";
import { FixButton } from "./fix-button";

export const FixProximityAnomalyButton = ({ onFix }: { onFix: () => void }) => {
  const translate = useTranslate();

  return (
    <FixButton
      label={translate("connect")}
      icon={<ConnectToPipeIcon size="md" />}
      onFix={onFix}
    />
  );
};
