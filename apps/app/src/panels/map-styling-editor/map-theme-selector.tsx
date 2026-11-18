import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import {
  SelectorList,
  triggerStylesFor,
  useSelectorPortalContainer,
} from "@epanet-js/ui-kit";
import { ChevronDownIcon } from "src/icons";
import type { MapTheme } from "src/state/map-themes";

const DEFAULT_THEME_OPTION = "default";

export const MapThemeSelector = ({
  id,
  themes,
  activeTheme,
  defaultName,
  isModified,
  disabled,
  onChange,
}: {
  id: string;
  themes: MapTheme[];
  activeTheme: MapTheme | undefined;
  defaultName: string;
  isModified: boolean;
  disabled: boolean;
  onChange: (id: string | null) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const portalContainer = useSelectorPortalContainer();
  const hasThemes = themes.length > 0;

  const commit = (value: string | null) => {
    const themeId = value === DEFAULT_THEME_OPTION ? null : value;
    if (themeId !== (activeTheme?.id ?? null)) onChange(themeId);
    setIsOpen(false);
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={disabled ? undefined : setIsOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          className={triggerStylesFor({}, { disabled })}
        >
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-nowrap overflow-hidden text-ellipsis">
              {activeTheme ? activeTheme.name : defaultName}
            </span>
            {isModified && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              />
            )}
          </div>
          <div className="px-1">
            <ChevronDownIcon />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer ?? undefined}>
        <Popover.Content
          side="bottom"
          align="start"
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={clsx(
            "bg-popover min-w-(--radix-popover-trigger-width) max-h-(--radix-popover-content-available-height)",
            "border text-size-base rounded-md shadow-md z-50 mt-1 overflow-hidden flex flex-col",
          )}
        >
          {hasThemes ? (
            <SelectorList<string>
              options={themes.map((t) => ({ value: t.id, label: t.name }))}
              selected={activeTheme ? activeTheme.id : null}
              nullable
              clearLabel={defaultName}
              onCommit={commit}
              onClose={() => setIsOpen(false)}
            />
          ) : (
            <SelectorList<string>
              options={[{ value: DEFAULT_THEME_OPTION, label: defaultName }]}
              selected={DEFAULT_THEME_OPTION}
              onCommit={commit}
              onClose={() => setIsOpen(false)}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
