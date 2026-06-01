import * as C from "@radix-ui/react-collapsible";

import { ChevronDownIcon, ChevronRightIcon } from "src/icons";
import { Button } from "../elements";
import { useNavigableListContext } from "./navigable-list";

type CollapsibleListSectionProps = {
  title: string;
  count?: number;
  sectionType: string;
  isOpen?: boolean;
  isFocused: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
  action?: { label: string; icon: React.ReactNode };
  onAction?: (sectionType: string) => void;
  readOnly?: boolean;
};

export const CollapsibleListSection = ({
  title,
  count,
  sectionType,
  isOpen: isOpenProp,
  isFocused,
  onToggle: onToggleProp,
  action,
  onAction,
  children,
  readOnly = false,
}: CollapsibleListSectionProps) => {
  const ctx = useNavigableListContext();
  const isOpen = isOpenProp ?? ctx?.sectionStatus[sectionType] ?? true;
  const onToggle = onToggleProp ?? (() => ctx?.toggleSection(sectionType));

  return (
    <C.Root open={isOpen} onOpenChange={onToggle}>
      <div
        data-section-type={sectionType}
        className={`group/section flex items-center justify-between h-8 px-1 ${
          isFocused ? "bg-base-active" : "hover:bg-base-hover"
        }`}
      >
        <C.Trigger asChild>
          <button className="flex-1 min-w-0 flex items-center gap-1 text-sm font-medium text-subtle">
            {isOpen ? (
              <ChevronDownIcon size="sm" />
            ) : (
              <ChevronRightIcon size="sm" />
            )}
            <span className="truncate">{title}</span>
            {count !== undefined && <span className="shrink-0">({count})</span>}
          </button>
        </C.Trigger>
        {!readOnly && action && onAction && (
          <Button
            variant="quiet"
            size="xs"
            aria-label={action.label}
            onClick={() => onAction(sectionType)}
            className="h-6 w-6 hover:bg-base-active"
          >
            {action.icon}
          </Button>
        )}
      </div>
      <C.Content>
        <ul className="pl-4">{children}</ul>
      </C.Content>
    </C.Root>
  );
};
