import * as C from "@radix-ui/react-collapsible";
import { useState } from "react";

import { ChevronDownIcon, ChevronRightIcon } from "src/icons";
import { Button } from "../elements";
import { ItemActions, type ItemAction } from "./item-actions";
import { useNavigableListContext } from "./navigable-list";

const SECTION_CHEVRON_CENTER_REM = 0.75;

type CollapsibleListSectionProps = {
  title: string;
  count?: number;
  sectionType: string;
  isOpen?: boolean;
  isFocused: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
  action?: { label: string; icon: React.ReactNode; disabled?: boolean };
  onAction?: (sectionType: string) => void;
  actionSlot?: React.ReactNode;
  menuActions?: ItemAction[];
  menuLabel?: string;
  onMenuAction?: (action: string) => void;
  readOnly?: boolean;
  showIndentGuide?: boolean;
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
  actionSlot,
  menuActions,
  menuLabel,
  onMenuAction,
  children,
  readOnly = false,
  showIndentGuide = false,
}: CollapsibleListSectionProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const ctx = useNavigableListContext();
  const isOpen = isOpenProp ?? ctx?.sectionStatus[sectionType] ?? true;
  const onToggle = onToggleProp ?? (() => ctx?.toggleSection(sectionType));

  return (
    <C.Root open={isOpen} onOpenChange={onToggle}>
      <div
        data-section-type={sectionType}
        className={`group group/section flex items-center justify-between h-8 px-1 rounded-sm ${
          isFocused || isMenuOpen ? "bg-base-hover" : "hover:bg-base-hover"
        }`}
      >
        <C.Trigger asChild>
          <button className="h-6 w-6 flex-1 min-w-0 flex items-center gap-1 text-sm font-medium text-default">
            {isOpen ? (
              <ChevronDownIcon size="md" />
            ) : (
              <ChevronRightIcon size="md" />
            )}
            <span className="font-semibold truncate">{title}</span>
            {count !== undefined && <span className="shrink-0">({count})</span>}
          </button>
        </C.Trigger>
        {!readOnly && actionSlot}
        {!readOnly && !actionSlot && action && onAction && (
          <Button
            variant="quiet"
            size="xxs"
            aria-label={action.label}
            disabled={action.disabled}
            onClick={() => onAction(sectionType)}
            className="h-6 w-6 shrink-0 justify-center hover:bg-base-hover"
          >
            {action.icon}
          </Button>
        )}
        {!readOnly && menuActions && menuActions.length > 0 && onMenuAction && (
          <ItemActions
            label={menuLabel}
            isSelected={false}
            actions={menuActions}
            onAction={onMenuAction}
            onOpenChange={setIsMenuOpen}
          />
        )}
      </div>
      <C.Content>
        <ul className="relative pl-4">
          {showIndentGuide && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-4 border-l border-base"
              style={{ left: `${SECTION_CHEVRON_CENTER_REM}rem` }}
            />
          )}
          {children}
        </ul>
      </C.Content>
    </C.Root>
  );
};
