import { useCallback, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import { Form, Formik } from "formik";

import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { Button } from "src/components/elements";
import { simulationSettingsAtom } from "src/state/jotai";
import { worktreeAtom } from "src/state/scenarios";

import { SimulationSettingsSidebar } from "./simulation-settings-sidebar";
import {
  SimulationSettingsContent,
  useTimeSettingsValidation,
} from "./simulation-settings-content";
import { useScrollSpy } from "./use-scroll-spy";
import { buildSectionIds } from "./simulation-settings-data";

export type SimulationModeOption = "steadyState" | "eps";

export type FormValues = {
  simulationMode: SimulationModeOption;
  duration: number | undefined;
  hydraulicTimestep: number | undefined;
  reportTimestep: number | undefined;
  patternTimestep: number | undefined;
};

export const SimulationSettingsNewDialog = () => {
  const { closeDialog } = useDialogState();
  const simulationSettings = useAtomValue(simulationSettingsAtom);
  const setSimulationSettings = useSetAtom(simulationSettingsAtom);
  const worktree = useAtomValue(worktreeAtom);
  const hasScenarios = worktree.scenarios.length > 0;

  const { timing } = simulationSettings;

  const sectionIds = useMemo(buildSectionIds, []);

  const { activeSection, scrollToSection, scrollContainerRef } =
    useScrollSpy(sectionIds);

  const initialValues: FormValues = {
    simulationMode: timing.duration > 0 ? "eps" : "steadyState",
    duration: timing.duration,
    hydraulicTimestep: timing.hydraulicTimestep,
    reportTimestep: timing.reportTimestep,
    patternTimestep: timing.patternTimestep,
  };

  const handleSubmit = useCallback(
    (values: FormValues) => {
      const newDuration =
        values.simulationMode === "steadyState" ? 0 : values.duration;
      const hasTimingChanges =
        newDuration !== timing.duration ||
        values.hydraulicTimestep !== timing.hydraulicTimestep ||
        values.reportTimestep !== timing.reportTimestep ||
        values.patternTimestep !== timing.patternTimestep;

      if (hasTimingChanges) {
        setSimulationSettings({
          version: nanoid(),
          timing: {
            duration: newDuration ?? 0,
            hydraulicTimestep:
              values.hydraulicTimestep ?? timing.hydraulicTimestep,
            reportTimestep: values.reportTimestep ?? timing.reportTimestep,
            patternTimestep: values.patternTimestep ?? timing.patternTimestep,
          },
        });
      }

      closeDialog();
    },
    [timing, setSimulationSettings, closeDialog],
  );

  return (
    <DialogContainer size="md" height="lg" onClose={closeDialog}>
      <DialogHeader title="Simulation Settings" />
      <Formik onSubmit={handleSubmit} initialValues={initialValues}>
        <SimulationSettingsForm
          activeSection={activeSection}
          scrollToSection={scrollToSection}
          scrollContainerRef={scrollContainerRef}
          readonly={hasScenarios}
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
  readonly,
  onClose,
}: {
  activeSection: string;
  scrollToSection: (sectionId: string) => void;
  scrollContainerRef: (node: HTMLDivElement | null) => void;
  readonly: boolean;
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
          <SimulationSettingsContent
            ref={scrollContainerRef}
            readonly={readonly}
          />
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
