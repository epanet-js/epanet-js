import { useId } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
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
import {
  ChevronDownIcon,
  CloseIcon,
  MoreActionsIcon,
  SaveIcon,
} from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { MapThemeSelector } from "./map-theme-selector";
import { ActionButton } from "src/components/action-button";
import { dialogAtom } from "src/state/dialog";
import { isPlayingAtom } from "src/state/simulation-playback";
import {
  activeMapThemeIdAtom,
  isMapThemeModifiedAtom,
  mapThemesAtom,
  type MapTheme,
} from "src/state/map-themes";

export const MapThemeBar = () => {
  const translate = useTranslate();
  const themes = useAtomValue(mapThemesAtom);
  const activeId = useAtomValue(activeMapThemeIdAtom);
  const isModified = useAtomValue(isMapThemeModifiedAtom);
  const applyMapTheme = useApplyMapTheme();
  const discardChanges = useResetMapThemeChanges();
  const isPlaying = useAtomValue(isPlayingAtom);
  const setDialog = useSetAtom(dialogAtom);
  const selectorId = useId();

  const activeTheme = themes.find((t) => t.id === activeId);
  const defaultName = translate("mapThemes.defaultTheme");
  const label = activeTheme
    ? activeTheme.name
    : isModified
      ? translate("mapThemes.unsavedTheme")
      : defaultName;

  return (
    <div
      className={clsx(
        "flex items-center -mx-1 mb-1 p-1 rounded-sm",
        isModified && "bg-accent-tint",
      )}
    >
      <label
        htmlFor={selectorId}
        className="shrink-0 mr-4 text-size-base text-subtle"
      >
        {translate("mapThemes.theme")}
      </label>
      <div className="flex-1 min-w-0 mr-1">
        <MapThemeSelector
          id={selectorId}
          themes={themes}
          activeTheme={activeTheme}
          defaultName={defaultName}
          label={label}
          disabled={isPlaying || isModified}
          onChange={applyMapTheme}
        />
      </div>
      {isModified &&
        (activeTheme ? (
          <SaveThemeMenu theme={activeTheme} disabled={isPlaying} />
        ) : (
          <ActionButton
            action={{
              label: translate("mapThemes.saveAsNew"),
              icon: <SaveIcon />,
              applicable: true,
              disabled: isPlaying,
              onSelect: () => {
                setDialog({ type: "saveMapThemeAsNew" });
                return Promise.resolve();
              },
            }}
          />
        ))}
      {isModified && (
        <ActionButton
          action={{
            label: translate("mapThemes.discardChanges"),
            icon: <CloseIcon />,
            applicable: true,
            disabled: isPlaying,
            onSelect: () => {
              discardChanges();
              return Promise.resolve();
            },
          }}
        />
      )}
      {!isModified && activeTheme && (
        <ThemeActionsMenu theme={activeTheme} disabled={isPlaying} />
      )}
    </div>
  );
};

const SaveThemeMenu = ({
  theme,
  disabled,
}: {
  theme: MapTheme;
  disabled: boolean;
}) => {
  const translate = useTranslate();
  const saveChanges = useSaveMapThemeChanges();
  const setDialog = useSetAtom(dialogAtom);

  return (
    <DD.Root modal={false}>
      <Tooltip delayDuration={700} content={translate("mapThemes.saveChanges")}>
        <DD.Trigger asChild disabled={disabled}>
          <Button
            variant="quiet"
            aria-label={translate("mapThemes.saveChanges")}
            className="h-8 shrink-0 gap-0 px-1.5 justify-center hover:bg-base-hover aria-expanded:bg-base-hover"
          >
            <SaveIcon />
            <ChevronDownIcon size="sm" />
          </Button>
        </DD.Trigger>
      </Tooltip>
      <DD.Portal>
        <DDContent align="end" side="bottom" className="z-50">
          <StyledItem onSelect={() => saveChanges()}>
            {translate("mapThemes.updateTheme", theme.name)}
          </StyledItem>
          <StyledItem onSelect={() => setDialog({ type: "saveMapThemeAsNew" })}>
            {translate("mapThemes.saveAsNew")}
          </StyledItem>
        </DDContent>
      </DD.Portal>
    </DD.Root>
  );
};

const ThemeActionsMenu = ({
  theme,
  disabled,
}: {
  theme: MapTheme;
  disabled: boolean;
}) => {
  const translate = useTranslate();
  const setDialog = useSetAtom(dialogAtom);

  return (
    <DD.Root modal={false}>
      <Tooltip delayDuration={700} content={translate("mapThemes.actions")}>
        <DD.Trigger asChild disabled={disabled}>
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
          <StyledItem onSelect={() => setDialog({ type: "saveMapThemeAsNew" })}>
            {translate("mapThemes.duplicate")}
          </StyledItem>
          <StyledItem
            onSelect={() =>
              setDialog({ type: "renameMapTheme", themeId: theme.id })
            }
          >
            {translate("mapThemes.rename")}
          </StyledItem>
          <DDSeparator />
          <StyledItem
            variant="destructive"
            onSelect={() =>
              setDialog({
                type: "deleteMapThemeConfirmation",
                themeId: theme.id,
              })
            }
          >
            {translate("mapThemes.delete")}
          </StyledItem>
        </DDContent>
      </DD.Portal>
    </DD.Root>
  );
};
