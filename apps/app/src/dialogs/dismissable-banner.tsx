import { CloseIcon } from "src/icons";

export const DismissableBanner = ({
  description,
  variant,
  onDismiss,
}: {
  description: string;
  variant: "default" | "warning" | "error" | "success";
  onDismiss: () => void;
}) => (
  <div
    className={`flex items-center justify-between px-4 py-2 border-b bg-${variant}-subtle h-12`}
  >
    <p className="text-size-base">{description}</p>
    <button
      className="flex gap-2 text-subtle shrink-0 focus:bg-base-hover hover:text-default"
      onClick={onDismiss}
      type="button"
    >
      <CloseIcon />
    </button>
  </div>
);
