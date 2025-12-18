import { useAtomValue } from "jotai";
import { useState } from "react";
import clsx from "clsx";

import { DialogContainer, DialogHeader, useDialogState } from "../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { dataAtom } from "src/state/jotai";
import { ControlsIcon } from "src/icons";
import { AckDialogAction } from "src/components/dialog";

type Tab = "simple" | "ruleBased";

export const ControlsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [activeTab, setActiveTab] = useState<Tab>("simple");

  const controls = hydraulicModel.controls;

  return (
    <DialogContainer size="md">
      <DialogHeader
        title={translate("controls.title")}
        titleIcon={ControlsIcon}
      />
      <div className="flex flex-col gap-4">
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <ControlsTextArea
          value={activeTab === "simple" ? controls.simple : controls.ruleBased}
          placeholder={
            activeTab === "simple"
              ? translate("controls.simpleEmpty")
              : translate("controls.rulesEmpty")
          }
        />
      </div>
      <AckDialogAction label={translate("cancel")} onAck={closeDialog} />
    </DialogContainer>
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
      className="flex h-8 border-b border-gray-200 dark:border-black px-8 -mx-8"
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
  value,
  placeholder,
}: {
  value: string;
  placeholder: string;
}) => {
  return (
    <textarea
      readOnly
      value={value}
      placeholder={placeholder}
      className="w-full h-64 p-3 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md resize-none focus:outline-none"
    />
  );
};
