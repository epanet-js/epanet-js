import { useCallback, useState, useMemo } from "react";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { Button } from "src/components/elements";
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

  const handleSave = useCallback(() => {
    // TODO: persist values to model
    closeDialog();
  }, [closeDialog]);

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
      <div className="flex items-center justify-end gap-3 pt-6">
        <Button type="button" variant="default" onClick={closeDialog}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={handleSave}>
          Save settings
        </Button>
      </div>
    </DialogContainer>
  );
};
