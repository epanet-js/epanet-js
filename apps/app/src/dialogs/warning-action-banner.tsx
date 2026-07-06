import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";

export const WarningActionBanner = ({
  description,
  onContinue,
  onCancel,
}: {
  description: string;
  onContinue: () => void;
  onCancel: () => void;
}) => {
  const translate = useTranslate();
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-error-subtle h-12">
      <p className="text-size-base">{description}</p>
      <div className="flex gap-2">
        <Button variant="default" size="sm" disabled={false} onClick={onCancel}>
          {translate("cancel")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={false}
          onClick={onContinue}
        >
          {translate("continue")}
        </Button>
      </div>
    </div>
  );
};
