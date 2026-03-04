import { useCallback, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Form, Formik } from "formik";

import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { Button } from "src/components/elements";
import { simulationSettingsAtom } from "src/state/jotai";

import { SimulationSettingsSidebar } from "./simulation-settings-sidebar";
import {
  SimulationSettingsContent,
  SettingsSection,
  GeneralSection,
  TimesSection,
  DemandsSection,
  HydraulicsSection,
  WaterQualitySection,
  EnergySection,
  useTimeSettingsValidation,
} from "./simulation-settings-content";
import { useScrollSpy } from "./use-scroll-spy";
import {
  buildSectionIds,
  buildInitialValues,
  hasChanges,
  buildUpdatedSettings,
} from "./simulation-settings-data";
import type { FormValues } from "./simulation-settings-data";

export type {
  FormValues,
  SimulationModeOption,
} from "./simulation-settings-data";

export const SimulationSettingsNewDialog = () => {
  const { closeDialog } = useDialogState();
  const simulationSettings = useAtomValue(simulationSettingsAtom);
  const setSimulationSettings = useSetAtom(simulationSettingsAtom);

  const sectionIds = useMemo(buildSectionIds, []);

  const { activeSection, scrollToSection, scrollContainerRef } =
    useScrollSpy(sectionIds);

  const initialValues = buildInitialValues(simulationSettings);

  const handleSubmit = useCallback(
    (values: FormValues) => {
      if (hasChanges(values, simulationSettings)) {
        setSimulationSettings(buildUpdatedSettings(values, simulationSettings));
      }
      closeDialog();
    },
    [simulationSettings, setSimulationSettings, closeDialog],
  );

  return (
    <DialogContainer size="md" height="lg" onClose={closeDialog}>
      <DialogHeader title="Simulation Settings" />
      <Formik onSubmit={handleSubmit} initialValues={initialValues}>
        <SimulationSettingsForm
          activeSection={activeSection}
          scrollToSection={scrollToSection}
          scrollContainerRef={scrollContainerRef}
          onClose={closeDialog}
        />
      </Formik>
    </DialogContainer>
  );
};

const SimulationSettingsForm = ({
  activeSection,
  scrollToSection,
  scrollContainerRef,
  onClose,
}: {
  activeSection: string;
  scrollToSection: (sectionId: string) => void;
  scrollContainerRef: (node: HTMLDivElement | null) => void;
  onClose: () => void;
}) => {
  const { hasValidationError } = useTimeSettingsValidation();

  return (
    <Form className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex min-h-0">
        <SimulationSettingsSidebar
          activeSection={activeSection}
          onSelectSection={scrollToSection}
        />
        <div className="flex-1 flex flex-col min-h-0">
          <SimulationSettingsContent ref={scrollContainerRef}>
            <SettingsSection sectionId="general">
              <GeneralSection />
            </SettingsSection>
            <SettingsSection sectionId="times">
              <TimesSection />
            </SettingsSection>
            <SettingsSection sectionId="demands">
              <DemandsSection />
            </SettingsSection>
            <SettingsSection sectionId="hydraulics">
              <HydraulicsSection />
            </SettingsSection>
            <SettingsSection sectionId="waterQuality">
              <WaterQualitySection />
            </SettingsSection>
            <SettingsSection sectionId="energy">
              <EnergySection />
            </SettingsSection>
          </SimulationSettingsContent>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 pt-6">
        <Button type="button" variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={hasValidationError}>
          Save settings
        </Button>
      </div>
    </Form>
  );
};
