import { useTranslate } from "src/hooks/use-translate";
import { PipesCrossinIcon } from "src/icons";
import { FixButton } from "./fix-button";

export const FixCrossingPipesButton = ({ onFix }: { onFix: () => void }) => {
  const translate = useTranslate();

  return (
    <FixButton
      label={translate("connect")}
      icon={<PipesCrossinIcon size="md" />}
      onFix={onFix}
    />
  );
};
