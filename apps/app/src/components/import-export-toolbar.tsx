import * as DD from "@radix-ui/react-dropdown-menu";
import { useTranslate } from "src/hooks/use-translate";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { ChevronDownIcon } from "src/icons";

export const ImportExportToolbar = ({
  onExportCsv,
  onExportXlsx,
  onImport,
  disabled = false,
  readOnly = false,
}: {
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onImport?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();

  return (
    <div className="flex items-center px-4 py-2 border-b h-12">
      <div className="flex items-center gap-2 ml-auto">
        <DD.Root>
          <DD.Trigger asChild>
            <Button variant="default" size="sm" disabled={disabled}>
              {translate("export")}
              <ChevronDownIcon />
            </Button>
          </DD.Trigger>
          <DDContent align="end">
            <StyledItem onSelect={onExportCsv}>
              {translate("exportCsv")}
            </StyledItem>
            <StyledItem onSelect={onExportXlsx}>
              {translate("exportXlsx")}
            </StyledItem>
          </DDContent>
        </DD.Root>
        {onImport && (
          <Button
            variant="default"
            size="sm"
            onClick={onImport}
            disabled={readOnly || disabled}
          >
            {translate("import")}
          </Button>
        )}
      </div>
    </div>
  );
};
