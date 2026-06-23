import { useTranslate } from "src/hooks/use-translate";
import { NotificationBanner } from "src/components/notifications";
import { TriangleAlert } from "lucide-react";

interface PipeErrorBannerProps {
  materialLabel: string;
  error: string | null;
}

export function PipeErrorBanner({
  materialLabel,
  error,
}: PipeErrorBannerProps) {
  const translate = useTranslate();

  if (!error) return null;

  return (
    <NotificationBanner
      variant="warning"
      title={translate("pipeLibrary.validation.invalidMaterial", materialLabel)}
      description={translate(error)}
      Icon={TriangleAlert}
      className="shrink-0 mb-3 mr-3 rounded-md"
    />
  );
}
