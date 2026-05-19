"use client";
import * as DD from "@radix-ui/react-dropdown-menu";
import { BaseDialog } from "src/components/dialog";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { ChevronDownIcon } from "src/icons";

export const CustomGraphDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();

  return (
    <BaseDialog
      title={translate("customGraph.title")}
      size="xl"
      height="xl"
      isOpen={true}
      onClose={onClose}
      footer={
        <footer className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200">
          <DD.Root>
            <DD.Trigger asChild>
              <Button variant="default" type="button">
                {translate("customGraph.exportAs")}
                <ChevronDownIcon />
              </Button>
            </DD.Trigger>
            <DDContent align="start" side="top">
              <StyledItem onSelect={() => {}}>
                {translate("customGraph.imagePng")}
              </StyledItem>
              <StyledItem onSelect={() => {}}>
                {translate("customGraph.tabularCsv")}
              </StyledItem>
              <StyledItem onSelect={() => {}}>
                {translate("customGraph.tabularXlsx")}
              </StyledItem>
            </DDContent>
          </DD.Root>
          <Button variant="default" type="button" onClick={onClose}>
            {translate("dialog.close")}
          </Button>
        </footer>
      }
    >
      <div className="p-4 text-sm">
        <p>Quick graph dialog placeholder.</p>
      </div>
    </BaseDialog>
  );
};
