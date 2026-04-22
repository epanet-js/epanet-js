import { useCallback, useMemo } from "react";
import { useAtomValue, useAtom } from "jotai";
import { Form, Formik } from "formik";

import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import * as db from "src/lib/db";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useSimulationSettingsTransaction } from "src/hooks/persistence/use-simulation-settings-transaction";

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
  const { transact: transactSimulationSettings } =
    useSimulationSettingsTransaction();
  const [projectSettings, setProjectSettings] = useAtom(projectSettingsAtom);
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const sectionIds = useMemo(buildSectionIds, []);

  const { activeSection, scrollToSection, scrollContainerRef } =
    useScrollSpy(sectionIds);

  const initialValues = buildInitialValues(simulationSettings);

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      if (hasChanges(values, simulationSettings)) {
        transactSimulationSettings(
          buildUpdatedSettings(values, simulationSettings),
        );
      }
      if (
        values.qualityMassUnit !== projectSettings.units.chemicalConcentration
      ) {
        const newProjectSettings = {
          ...projectSettings,
          units: {
            ...projectSettings.units,
            chemicalConcentration: values.qualityMassUnit,
          },
        };
        setProjectSettings(newProjectSettings);
        if (isOurFileOn) {
          await db.saveProjectSettings(newProjectSettings);
        }
      }
      closeDialog();
    },
    [
      simulationSettings,
      transactSimulationSettings,
      projectSettings,
      setProjectSettings,
      closeDialog,
      isOurFileOn,
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
