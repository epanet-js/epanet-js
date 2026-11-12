import { useEffect, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import {
  activeMapThemeIdAtom,
  mapThemeActionAtom,
  mapThemesAtom,
} from "src/state/map-themes";

export const SaveMapThemeAsNewDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const themes = useAtomValue(mapThemesAtom);
  const activeId = useAtomValue(activeMapThemeIdAtom);
  const dispatch = useSetAtom(mapThemeActionAtom);
  const activeTheme = themes.find((t) => t.id === activeId);

  return (
    <MapThemeNameDialog
      title={translate("mapThemes.saveAsNewTitle")}
      initialName={
        activeTheme
          ? translate("mapThemes.copyName", activeTheme.name)
          : translate("mapThemes.newThemeName")
      }
      onSave={(name) => dispatch({ type: "saveAsNew", name })}
      onClose={onClose}
    />
  );
};

export const RenameMapThemeDialog = ({
  themeId,
  onClose,
}: {
  themeId: string;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const themes = useAtomValue(mapThemesAtom);
  const dispatch = useSetAtom(mapThemeActionAtom);
  const theme = themes.find((t) => t.id === themeId);

  if (!theme) return null;

  return (
    <MapThemeNameDialog
      title={translate("mapThemes.renameTitle")}
      initialName={theme.name}
      onSave={(name) => dispatch({ type: "rename", id: themeId, name })}
      onClose={onClose}
    />
  );
};

export const DeleteMapThemeConfirmationDialog = ({
  themeId,
  onClose,
}: {
  themeId: string;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const themes = useAtomValue(mapThemesAtom);
  const dispatch = useSetAtom(mapThemeActionAtom);
  const theme = themes.find((t) => t.id === themeId);

  if (!theme) return null;

  return (
    <BaseDialog
      title={translate("mapThemes.deleteTitle")}
      size="xs"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("delete")}
          actionVariant="danger"
          onAction={() => {
            onClose();
            dispatch({ type: "delete", id: themeId });
          }}
          secondary={{ action: translate("dialog.cancel"), onClick: onClose }}
        />
      }
    >
      <p className="p-4 text-size-base">
        {translate("mapThemes.deleteDescription", theme.name)}
      </p>
    </BaseDialog>
  );
};

const MapThemeNameDialog = ({
  title,
  initialName,
  onSave,
  onClose,
}: {
  title: string;
  initialName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, []);

  const submit = () => {
    if (!trimmed) return;
    onClose();
    onSave(trimmed);
  };

  return (
    <BaseDialog
      title={title}
      size="xs"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("dialog.save")}
          onAction={submit}
          isDisabled={!trimmed}
          autoFocusSubmit={false}
          secondary={{ action: translate("dialog.cancel"), onClick: onClose }}
        />
      }
    >
      <form
        className="p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block space-y-2">
          <span className="block text-size-base text-default">
            {translate("name")}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={clsx(
              "w-full px-3 py-2 border rounded-sm text-size-base",
              "border-strong focus-visible:ring-accent",
            )}
          />
        </label>
      </form>
    </BaseDialog>
  );
};
