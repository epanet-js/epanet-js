import { useCallback, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Form, Formik } from "formik";

import {
  BaseDialog,
  DialogContainer,
  DialogHeader,
  SimpleDialogActionsNew,
  useDialogState,
} from "../../dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { dataAtom } from "src/state/data";

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

export const SimulationSettingsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const simulationSettings = useAtomValue(simulationSettingsAtom);
  const setSimulationSettings = useSetAtom(simulationSettingsAtom);
  const data = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);

  const sectionIds = useMemo(buildSectionIds, []);

  const { activeSection, scrollToSection, scrollContainerRef } =
    useScrollSpy(sectionIds);

  const currentPressureUnit = data.modelMetadata.units.pressure;
  const initialValues = buildInitialValues(
    simulationSettings,
    currentPressureUnit,
  );

  const handleSubmit = useCallback(
    (values: FormValues) => {
      const pressureChanged = values.pressureUnit !== currentPressureUnit;
      const settingsChanged = hasChanges(values, simulationSettings);

      if (pressureChanged || settingsChanged) {
        setSimulationSettings(buildUpdatedSettings(values, simulationSettings));
      }

      if (pressureChanged) {
        const newQuantities = data.modelMetadata.quantities.withPressureUnit(
          values.pressureUnit,
        );
        setData({
          ...data,
          modelMetadata: {
            ...data.modelMetadata,
            quantities: newQuantities,
            units: {
              ...data.modelMetadata.units,
              pressure: values.pressureUnit,
            },
          },
        });
      }

      closeDialog();
    },
    [
      simulationSettings,
      setSimulationSettings,
      currentPressureUnit,
      data,
      setData,
      closeDialog,
    ],
  );

  const isModalsOn = useFeatureFlag("FLAG_MODALS");

  if (isModalsOn) {
    return (
      <Formik onSubmit={handleSubmit} initialValues={initialValues}>
        {({ submitForm, isSubmitting }) => (
          <BaseDialog
            title={translate("simulationSettings.title")}
            size="md"
            height="lg"
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
  }

  return (
    <DialogContainer size="md" height="lg" onClose={closeDialog}>
      <DialogHeader title={translate("simulationSettings.title")} />
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
  const { hasValidationError } = useTimeSettingsValidation();

  return (
    <SimpleDialogActionsNew
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
  const translate = useTranslate();
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
          {translate("dialog.cancel")}
        </Button>
        <Button type="submit" variant="primary" disabled={hasValidationError}>
          {translate("simulationSettings.save")}
        </Button>
      </div>
    </Form>
  );
};
