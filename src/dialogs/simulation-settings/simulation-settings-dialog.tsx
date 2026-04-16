import { useCallback, useMemo } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import { Form, Formik } from "formik";

import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";

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
  useQualitySettingsValidation,
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

export const SimulationSettingsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const setSimulationSettings = useSetAtom(simulationSettingsDerivedAtom);
  const [projectSettings, setProjectSettings] = useAtom(projectSettingsAtom);

  const sectionIds = useMemo(buildSectionIds, []);

  const { activeSection, scrollToSection, scrollContainerRef } =
    useScrollSpy(sectionIds);

  const initialValues = buildInitialValues(simulationSettings);

  const handleSubmit = useCallback(
    (values: FormValues) => {
      if (hasChanges(values, simulationSettings)) {
        setSimulationSettings(buildUpdatedSettings(values, simulationSettings));
      }
      if (
        values.qualityMassUnit !== projectSettings.units.chemicalConcentration
      ) {
        setProjectSettings({
          ...projectSettings,
          units: {
            ...projectSettings.units,
            chemicalConcentration: values.qualityMassUnit,
          },
        });
      }
      closeDialog();
    },
    [
      simulationSettings,
      setSimulationSettings,
      projectSettings,
      setProjectSettings,
      closeDialog,
    ],
  );

  return (
    <Formik onSubmit={handleSubmit} initialValues={initialValues}>
      {({ submitForm, isSubmitting }) => (
        <BaseDialog
          title={translate("simulationSettings.title")}
          size="lg"
          height="xl"
          isOpen={true}
          onClose={closeDialog}
          footer={
            <SimulationSettingsFooter
              submitForm={submitForm}
              isSubmitting={isSubmitting}
              onClose={closeDialog}
            />
          }
        >
          <Form className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex min-h-0">
              <SimulationSettingsSidebar
                activeSection={activeSection}
                onSelectSection={scrollToSection}
              />
              <div className="border-l border-gray-200 flex-1 flex flex-col min-h-0">
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
          </Form>
        </BaseDialog>
      )}
    </Formik>
  );
};

const SimulationSettingsFooter = ({
  submitForm,
  isSubmitting,
  onClose,
}: {
  submitForm: () => void;
  isSubmitting: boolean;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const { hasValidationError: hasTimeError } = useTimeSettingsValidation();
  const { hasValidationError: hasQualityError } =
    useQualitySettingsValidation();
  const hasValidationError = hasTimeError || hasQualityError;

  return (
    <SimpleDialogActions
      action={translate("simulationSettings.save")}
      onAction={submitForm}
      isSubmitting={isSubmitting}
      isDisabled={hasValidationError}
      secondary={{
        action: translate("dialog.cancel"),
        onClick: onClose,
      }}
    />
  );
};
