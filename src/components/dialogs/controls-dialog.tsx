import { useAtomValue } from "jotai";
import { useState, useCallback } from "react";
import clsx from "clsx";
import { Form, Formik, useFormikContext } from "formik";

import { BaseDialog, SimpleDialogActions, useDialogState } from "../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import {
  formatSimpleControl,
  formatRuleBasedControl,
  IdResolver,
  parseControlsFromText,
} from "src/hydraulic-model/controls";
import { usePersistence } from "src/lib/persistence";
import { changeControls } from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";

type Tab = "simple" | "ruleBased";

type FormValues = {
  simpleText: string;
  rulesText: string;
};

export const ControlsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const [activeTab, setActiveTab] = useState<Tab>("simple");
  const isSnapshotLocked = useIsSnapshotLocked();

  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const { controls, assets } = hydraulicModel;

  const idResolver: IdResolver = (assetId) => {
    const asset = assets.get(assetId);
    return asset?.label ?? String(assetId);
  };

  const initialSimpleText = controls.simple
    .map((control) => formatSimpleControl(control, idResolver))
    .join("\n");

  const initialRulesText = controls.rules
    .map((rule) => formatRuleBasedControl(rule, idResolver))
    .join("\n\n");

  const initialValues: FormValues = {
    simpleText: initialSimpleText,
    rulesText: initialRulesText,
  };

  const handleSubmit = useCallback(
    (values: FormValues) => {
      const newControls = parseControlsFromText(
        values.simpleText,
        values.rulesText,
        assets,
      );
      userTracking.capture({
        name: "controls.changed",
        simpleControlsCount: newControls.simple.length,
        rulesCount: newControls.rules.length,
      });
      const moment = changeControls(hydraulicModel, newControls);
      transact(moment);
      closeDialog();
    },
    [assets, hydraulicModel, transact, closeDialog, userTracking],
  );

  return (
    <Formik onSubmit={handleSubmit} initialValues={initialValues}>
      {({ submitForm, isSubmitting }) => (
        <BaseDialog
          title={translate("controls.title")}
          size="lg"
          isOpen={true}
          onClose={closeDialog}
          footer={
            <SimpleDialogActions
              action={isSnapshotLocked ? undefined : translate("dialog.save")}
              onAction={submitForm}
              isSubmitting={isSubmitting}
              secondary={{
                action: translate("dialog.cancel"),
                onClick: closeDialog,
              }}
            />
          }
        >
          <Form>
            <div className="flex flex-col gap-4 p-4">
              <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
              <ControlsTextArea
                name="simpleText"
                placeholder={translate("controls.simpleEmpty")}
                hidden={activeTab !== "simple"}
                readOnly={isSnapshotLocked}
              />
              <ControlsTextArea
                name="rulesText"
                placeholder={translate("controls.rulesEmpty")}
                hidden={activeTab !== "ruleBased"}
                readOnly={isSnapshotLocked}
              />
            </div>
          </Form>
        </BaseDialog>
      )}
    </Formik>
  );
};

const TabBar = ({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) => {
  const translate = useTranslate();

  return (
    <div
      role="tablist"
      className="flex h-8 border-b border-gray-200 dark:border-black px-4 -mx-4"
    >
      <TabButton
        label={translate("controls.simpleTab")}
        isActive={activeTab === "simple"}
        onClick={() => onTabChange("simple")}
      />
      <TabButton
        label={translate("controls.rulesTab")}
        isActive={activeTab === "ruleBased"}
        onClick={() => onTabChange("ruleBased")}
      />
    </div>
  );
};

const TabButton = ({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={clsx(
        "text-sm py-1 px-3 focus:outline-none border-t border-l border-b last:border-r border-gray-200",
        isActive
          ? "text-black dark:text-white border-b-white -mb-px"
          : "text-gray-500 dark:text-gray-400 border-b-transparent hover:text-black dark:hover:text-gray-200 bg-gray-100",
      )}
    >
      {label}
    </button>
  );
};

const ControlsTextArea = ({
  name,
  placeholder,
  hidden,
  readOnly = false,
}: {
  name: string;
  placeholder: string;
  hidden: boolean;
  readOnly?: boolean;
}) => {
  const { values, setFieldValue } = useFormikContext<FormValues>();
  const value = values[name as keyof FormValues];

  if (hidden) return null;

  return (
    <textarea
      value={value}
      onChange={(e) => setFieldValue(name, e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className="w-full h-64 p-3 font-mono text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-sm resize-none focus-visible:outline-none focus-visible:border-transparent focus-visible:ring-purple-500 dark:focus-visible:ring-purple-700 focus-visible:ring-inset"
    />
  );
};
