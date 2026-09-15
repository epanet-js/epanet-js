import { memo } from "react";
import clsx from "clsx";

export const SideTabList = memo(function SideTabList({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: { id: string; label: string }[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        gridTemplateColumns: `repeat(${tabs.length}, 1fr) min-content`,
      }}
      className="flex-0 grid h-8 flex-none
      sticky top-0 z-10
      bg-popover
      divide-x divide-gray-200 dark:divide-black"
    >
      {tabs.map((tab) => (
        <SideTab
          key={tab.id}
          label={tab.label}
          active={tab.id === activeId}
          onClick={() => onSelect(tab.id)}
        />
      ))}
    </div>
  );
});

const SideTab = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    role="tab"
    onClick={onClick}
    aria-selected={active}
    className={clsx(
      "text-left text-size-base py-1 px-3 focus:outline-hidden",
      active
        ? "text-black"
        : `
        bg-panel
        border-b dark:border-black
        text-subtle
        hover:text-black dark:hover:text-gray-200
        focus:text-black`,
    )}
  >
    {label}
  </button>
);
