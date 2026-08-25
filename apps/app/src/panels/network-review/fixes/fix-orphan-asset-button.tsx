import { useTranslate } from "src/hooks/use-translate";
import { DeactivateTopologyIcon, DeleteIcon } from "src/icons";
import { FixButton } from "./fix-button";
import { OrphanKind } from "./use-fix-orphan-asset";

export const FixOrphanAssetButton = ({
  kind,
  onFix,
}: {
  kind: OrphanKind;
  onFix: () => void;
}) => {
  const translate = useTranslate();
  const isDeactivate = kind === "isolatedLink";

  return (
    <FixButton
      label={translate(isDeactivate ? "deactivateAssets" : "delete")}
      variant={isDeactivate ? "quiet" : "danger-quiet"}
      icon={
        isDeactivate ? (
          <DeactivateTopologyIcon size="md" />
        ) : (
          <DeleteIcon size="md" />
        )
      }
      onFix={onFix}
    />
  );
};
