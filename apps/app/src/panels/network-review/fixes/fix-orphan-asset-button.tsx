import { Button } from "src/components/elements";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useTranslate } from "src/hooks/use-translate";
import { ActiveTopologyDisableIcon, DeleteIcon } from "src/icons";
import { OrphanKind } from "src/lib/network-review";

export const FixOrphanAssetButton = ({
  kind,
  onFix,
}: {
  kind: OrphanKind;
  onFix: () => void;
}) => {
  const translate = useTranslate();
  const isEditionBlocked = useIsEditionBlocked();

  const isDeactivate = kind === "isolatedLink";
  const label = translate(isDeactivate ? "deactivateAssets" : "delete");

  return (
    <Button
      variant={isDeactivate ? "quiet" : "danger-quiet"}
      size="xxs"
      aria-label={label}
      title={label}
      tabIndex={-1}
      disabled={isEditionBlocked}
      className="h-6 w-6 self-center justify-center"
      onClick={(e) => {
        e.stopPropagation();
        onFix();
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {isDeactivate ? (
        <ActiveTopologyDisableIcon size="md" />
      ) : (
        <DeleteIcon size="md" />
      )}
    </Button>
  );
};
