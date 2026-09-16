import { useTranslate } from "src/hooks/use-translate";
import { Callout } from "@epanet-js/ui-kit";
import { TriangleAlert } from "lucide-react";
import type { MaterialValidationError } from "src/hydraulic-model/pipe-materials";

interface PipeErrorBannerProps {
  materialLabel: string;
  error: MaterialValidationError | null;
}

export function PipeErrorBanner({
  materialLabel,
  error,
}: PipeErrorBannerProps) {
  const translate = useTranslate();

  if (!error) return null;

  return (
    <Callout
      variant="warning"
      title={translate("pipeLibrary.validation.invalidMaterial", materialLabel)}
      description={translate(`pipeLibrary.${error.code}`)}
      Icon={TriangleAlert}
      className="shrink-0 mb-3 mr-3 rounded-md"
    />
  );
}
