import { useId } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  useApplyMapTheme,
  useResetMapThemeChanges,
  useSaveMapThemeChanges,
} from "src/commands/map-themes";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Tooltip } from "@epanet-js/ui-kit";
import {
  Button,
  DDContent,
  DDSeparator,
  StyledItem,
} from "src/components/elements";
import { MoreActionsIcon, SaveIcon, UndoIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { MapThemeSelector } from "./map-theme-selector";
import { ActionButton } from "src/components/action-button";
import { dialogAtom } from "src/state/dialog";
import { isPlayingAtom } from "src/state/simulation-playback";
import {
  activeMapThemeIdAtom,
  isMapThemeModifiedAtom,
  mapThemesAtom,
} from "src/state/map-themes";

export const MapThemeBar = () => {
  const translate = useTranslate();
  const themes = useAtomValue(mapThemesAtom);
  const activeId = useAtomValue(activeMapThemeIdAtom);
  const isModified = useAtomValue(isMapThemeModifiedAtom);
  const applyMapTheme = useApplyMapTheme();
  const saveChanges = useSaveMapThemeChanges();
  const resetChanges = useResetMapThemeChanges();
  const isPlaying = useAtomValue(isPlayingAtom);
  const setDialog = useSetAtom(dialogAtom);
  const selectorId = useId();

  const activeTheme = themes.find((t) => t.id === activeId);
  const isDefault = !activeTheme;
  const defaultName = translate("mapThemes.defaultTheme");
  const activeName = activeTheme ? activeTheme.name : defaultName;
  const saveLabel = isDefault
    ? translate("mapThemes.saveAsNew")
    : translate("mapThemes.saveChangesTo", activeName);

  return (
    <div className="flex items-center pb-2">
      <label
        htmlFor={selectorId}
        className="shrink-0 mr-4 text-size-base text-subtle"
      >
        {translate("mapThemes.theme")}
      </label>
      <div className="flex-1 min-w-0">
        <MapThemeSelector
          id={selectorId}
          themes={themes}
          activeTheme={activeTheme}
          defaultName={defaultName}
          isModified={isModified}
          disabled={isPlaying}
          onChange={applyMapTheme}
        />
      </div>
      <ActionButton
        action={{
          label: saveLabel,
          icon: <SaveIcon />,
          applicable: true,
          disabled: isPlaying || !isModified,
          onSelect: () => {
            if (isDefault) setDialog({ type: "saveMapThemeAsNew" });
            else saveChanges();
            return Promise.resolve();
          },
        }}
      />
      {activeTheme ? (
        <DD.Root modal={false}>
          <Tooltip delayDuration={700} content={translate("mapThemes.actions")}>
            <DD.Trigger asChild disabled={isPlaying}>
              <Button
                variant="quiet"
                aria-label={translate("mapThemes.actions")}
                className="h-8 w-8 shrink-0 justify-center hover:bg-base-hover aria-expanded:bg-base-hover"
              >
                <MoreActionsIcon />
              </Button>
            </DD.Trigger>
          </Tooltip>
          <DD.Portal>
            <DDContent align="end" side="bottom" className="z-50">
              <StyledItem
                onSelect={() => setDialog({ type: "saveMapThemeAsNew" })}
              >
                {translate("mapThemes.saveAsNew")}
              </StyledItem>
              <MenuItem disabled={!isModified} onSelect={() => resetChanges()}>
                {translate("mapThemes.resetChanges")}
              </MenuItem>
              <DDSeparator />
              <MenuItem
                onSelect={() =>
                  setDialog({ type: "renameMapTheme", themeId: activeTheme.id })
                }
              >
                {translate("mapThemes.rename")}
              </MenuItem>
              <DDSeparator />
              <MenuItem
                variant="destructive"
                onSelect={() =>
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
      ) : (
        <ActionButton
          action={{
            label: translate("mapThemes.resetChanges"),
            icon: <UndoIcon />,
            applicable: true,
            disabled: isPlaying || !isModified,
            onSelect: () => {
              resetChanges();
              return Promise.resolve();
            },
          }}
        />
      )}
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
