import clsx from "clsx";
import { styledButton } from "src/components/elements";
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

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={translate("panels.closePanel", panelLabel)}
      className={clsx(
        styledButton({ size: "xxs", variant: "quiet" }),
        "absolute right-1 top-1/2 -translate-y-1/2",
        "h-5 w-5 inline-flex items-center justify-center",
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
