import { useCallback, useState, useMemo } from "react";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { SettingsIcon } from "src/icons";
import { SimulationSettingsSidebar } from "./simulation-settings-sidebar";
import { SimulationSettingsContent } from "./simulation-settings-content";
import { useScrollSpy } from "./use-scroll-spy";
import {
  buildSectionIds,
  buildDefaultValues,
} from "./simulation-settings-data";

export const SimulationSettingsNewDialog = () => {
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
      <DialogHeader title="Simulation Settings" titleIcon={SettingsIcon} />
      <div className="flex-1 flex min-h-0">
        <SimulationSettingsSidebar
          activeSection={activeSection}
          onSelectSection={scrollToSection}
        />
        <div className="flex-1 flex flex-col min-h-0">
          <SimulationSettingsContent
            ref={scrollContainerRef}
            values={values}
            onChange={handleChange}
          />
        </div>
      </div>
    </DialogContainer>
  );
};
