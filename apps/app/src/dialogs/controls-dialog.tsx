import { useAtomValue } from "jotai";
import { useState, useCallback } from "react";
import clsx from "clsx";
import { Form, Formik, useFormikContext } from "formik";

import {
  BaseDialog,
  SimpleDialogActions,
  useDialogState,
} from "../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import {
  formatSimpleControl,
  formatRuleBasedControl,
  IdResolver,
  parseRawControlsFromText,
} from "@epanet-js/hydraulic-model";
import { changeRawControls } from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Message } from "src/components/message";

type Tab = "simple" | "ruleBased";

type FormValues = {
  simpleText: string;
  rulesText: string;
};

export const ControlsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const [activeTab, setActiveTab] = useState<Tab>("simple");
  const isEditionBlocked = useIsEditionBlocked();
  const isPumpControlsOn = useFeatureFlag("FLAG_PUMP_CONTROLS");

  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();

  const { rawControls, assets } = hydraulicModel;

  const idResolver: IdResolver = (assetId) => {
    const asset = assets.get(assetId);
    return asset?.label ?? String(assetId);
  };

  const initialSimpleText = rawControls.simple
    .map((control) => formatSimpleControl(control, idResolver))
    .join("\n");

  const initialRulesText = rawControls.rules
    .map((rule) => formatRuleBasedControl(rule, idResolver))
    .join("\n\n");

  const initialValues: FormValues = {
    simpleText: initialSimpleText,
    rulesText: initialRulesText,
  };

  const handleSubmit = useCallback(
    (values: FormValues) => {
      const newControls = parseRawControlsFromText(
        values.simpleText,
        values.rulesText,
        assets,
      );
      userTracking.capture({
        name: "controls.changed",
        simpleControlsCount: newControls.simple.length,
        rulesCount: newControls.rules.length,
      });
      const moment = changeRawControls(hydraulicModel, newControls);
      transact(moment);
      closeDialog();
    },
    [assets, hydraulicModel, transact, closeDialog, userTracking],
  );

  return (
    <Formik onSubmit={handleSubmit} initialValues={initialValues}>
      {({ submitForm, isSubmitting }) => (
        <BaseDialog
          title={translate(
            isPumpControlsOn ? "controls.epanetTitle" : "controls.title",
          )}
          size="lg"
          isOpen={true}
          onClose={closeDialog}
          footer={
            <SimpleDialogActions
              action={isEditionBlocked ? undefined : translate("dialog.save")}
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
              {isPumpControlsOn && (
                <Message
                  variant="info"
                  title={translate("controls.nativeControlsInfoTitle")}
                >
                  <div className="space-y-2">
                    <p>{translate("controls.nativeControlsInfoDescription")}</p>
                    <p>{translate("controls.nativeControlsInfoNote")}</p>
                  </div>
                </Message>
              )}
              <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
              <ControlsTextArea
                name="simpleText"
                placeholder={translate("controls.simpleEmpty")}
                hidden={activeTab !== "simple"}
                readOnly={isEditionBlocked}
              />
              <ControlsTextArea
                name="rulesText"
                placeholder={translate("controls.rulesEmpty")}
                hidden={activeTab !== "ruleBased"}
                readOnly={isEditionBlocked}
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
    <div role="tablist" className="flex h-8 border-b px-4 -mx-4">
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
        "text-size-base py-1 px-3 focus:outline-hidden border-t border-l border-b last:border-r",
        isActive
          ? "text-default border-b-white -mb-px"
          : "text-subtle border-b-transparent hover:text-black dark:hover:text-gray-200 bg-panel",
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
      className="w-full h-64 p-3 font-mono text-size-base bg-base border border-strong rounded-xs resize-none focus-visible:outline-hidden focus-visible:border-transparent focus-visible:ring-accent focus-visible:ring-inset"
    />
  );
};
