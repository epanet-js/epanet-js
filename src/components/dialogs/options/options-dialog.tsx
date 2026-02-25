import { useCallback, useState, useMemo } from "react";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { SettingsIcon } from "src/icons";
import { OptionsSidebar } from "./options-sidebar";
import { OptionsContent } from "./options-content";
import { useScrollSpy } from "./use-scroll-spy";
import { buildSectionIds, buildDefaultValues } from "./options-data";

export const OptionsDialog = () => {
  const { closeDialog } = useDialogState();

  const sectionIds = useMemo(buildSectionIds, []);

  const { activeSection, scrollToSection, scrollContainerRef } =
    useScrollSpy(sectionIds);

  const [values, setValues] =
    useState<Record<string, string | number>>(buildDefaultValues);

  const handleChange = useCallback(
    (optionId: string, value: string | number) => {
      setValues((prev) => ({ ...prev, [optionId]: value }));
    },
    [],
  );

  return (
    <DialogContainer size="md" height="lg" onClose={closeDialog}>
      <DialogHeader title="Options" titleIcon={SettingsIcon} />
      <div className="flex-1 flex min-h-0">
        <OptionsSidebar
          activeSection={activeSection}
          onSelectSection={scrollToSection}
        />
        <div className="flex-1 flex flex-col min-h-0">
          <OptionsContent
            ref={scrollContainerRef}
            values={values}
            onChange={handleChange}
          />
        </div>
      </div>
    </DialogContainer>
  );
};
