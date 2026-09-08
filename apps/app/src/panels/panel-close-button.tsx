import clsx from "clsx";
import { styledButton } from "src/components/elements";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useTranslate } from "src/hooks/use-translate";
import { CloseIcon } from "src/icons";

export const PanelCloseButton = ({
  panelLabel,
  onClose,
}: {
  panelLabel: string;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const revealOnHover = useFeatureFlag("FLAG_PARTIAL_DATA_TABLES");

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={translate("panels.closePanel", panelLabel)}
      className={clsx(
        styledButton({ size: "xxs", variant: "quiet" }),
        "absolute right-1 top-1/2 -translate-y-1/2",
        "h-5 w-5 inline-flex items-center justify-center",
        revealOnHover &&
          `opacity-0 transition-opacity group-hover:opacity-100
          group-focus-within:opacity-100
          group-data-[state=active]:opacity-100`,
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onFocus={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <CloseIcon size="sm" />
    </span>
  );
};
