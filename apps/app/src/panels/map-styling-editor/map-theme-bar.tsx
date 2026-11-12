import { useId } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Selector } from "@epanet-js/ui-kit";
import {
  Button,
  DDContent,
  DDSeparator,
  StyledItem,
} from "src/components/elements";
import { MoreActionsIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { dialogAtom } from "src/state/dialog";
import {
  DEFAULT_MAP_THEME_ID,
  activeMapThemeIdAtom,
  isMapThemeModifiedAtom,
  mapThemeActionAtom,
  mapThemesAtom,
} from "src/state/map-themes";

export const MapThemeBar = () => {
  const translate = useTranslate();
  const themes = useAtomValue(mapThemesAtom);
  const activeId = useAtomValue(activeMapThemeIdAtom);
  const isModified = useAtomValue(isMapThemeModifiedAtom);
  const dispatch = useSetAtom(mapThemeActionAtom);
  const setDialog = useSetAtom(dialogAtom);
  const selectorId = useId();

  const activeTheme = themes.find((t) => t.id === activeId);
  const isDefault = !activeTheme;
  const defaultName = translate("mapThemes.defaultTheme");
  const activeName = activeTheme ? activeTheme.name : defaultName;
  const copyNameOf = (name: string) => translate("mapThemes.copyName", name);

  const options = [
    { value: DEFAULT_MAP_THEME_ID, label: defaultName },
    ...themes.map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div className="flex items-center gap-2 pb-2">
      <label
        htmlFor={selectorId}
        className="shrink-0 text-size-base text-subtle"
      >
        {translate("mapThemes.theme")}
      </label>
      <div className="flex-1 min-w-0">
        <Selector
          id={selectorId}
          options={options}
          selected={activeTheme ? activeTheme.id : DEFAULT_MAP_THEME_ID}
          onChange={(id) => dispatch({ type: "apply", id })}
        />
      </div>
      <DD.Root modal={false}>
        <DD.Trigger asChild>
          <Button
            variant="quiet"
            aria-label={translate(
              isModified ? "mapThemes.actionsUnsaved" : "mapThemes.actions",
            )}
            className="relative h-8 w-8 shrink-0 justify-center hover:bg-base-hover aria-expanded:bg-base-hover"
          >
            <MoreActionsIcon />
            {isModified && (
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent"
              />
            )}
          </Button>
        </DD.Trigger>
        <DD.Portal>
          <DDContent align="end" side="bottom" className="z-50">
            <StyledItem
              onSelect={() => setDialog({ type: "saveMapThemeAsNew" })}
            >
              {translate("mapThemes.saveAsNew")}
            </StyledItem>
            <MenuItem
              disabled={isDefault || !isModified}
              onSelect={() => dispatch({ type: "saveChanges" })}
            >
              {translate("mapThemes.saveChangesTo", activeName)}
            </MenuItem>
            <MenuItem
              disabled={!isModified}
              onSelect={() => dispatch({ type: "resetChanges" })}
            >
              {translate("mapThemes.resetChanges")}
            </MenuItem>
            <DDSeparator />
            <MenuItem
              disabled={isDefault}
              onSelect={() =>
                activeTheme &&
                setDialog({ type: "renameMapTheme", themeId: activeTheme.id })
              }
            >
              {translate("mapThemes.rename")}
            </MenuItem>
            <MenuItem
              disabled={isDefault}
              onSelect={() =>
                activeTheme &&
                dispatch({
                  type: "duplicate",
                  id: activeTheme.id,
                  name: copyNameOf(activeTheme.name),
                })
              }
            >
              {translate("duplicate")}
            </MenuItem>
            <DDSeparator />
            <MenuItem
              variant="destructive"
              disabled={isDefault}
              onSelect={() =>
                activeTheme &&
                setDialog({
                  type: "deleteMapThemeConfirmation",
                  themeId: activeTheme.id,
                })
              }
            >
              {translate("mapThemes.delete")}
            </MenuItem>
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
};

const MenuItem = ({
  disabled,
  variant,
  onSelect,
  children,
}: {
  disabled?: boolean;
  variant?: "destructive";
  onSelect: () => void;
  children: React.ReactNode;
}) => (
  <StyledItem
    variant={variant}
    disabled={disabled}
    className={disabled ? "opacity-60" : undefined}
    onSelect={onSelect}
  >
    {children}
  </StyledItem>
);
