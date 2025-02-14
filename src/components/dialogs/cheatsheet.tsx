import { DialogHeader } from "src/components/dialog";
import { Keycap } from "src/components/elements";
import React, { Fragment } from "react";
import { localizeKeybinding, translate } from "src/infra/i18n";
import { KeyboardIcon } from "@radix-ui/react-icons";

export const SEARCH_KEYBINDING = "Command+k";

const BINDINGS = {
  "Alt+N": translate("newProject"),
  "Command+O": translate("openProject"),
  "Command+S": translate("save"),
  "Command+Shift+S": translate("save"),
  "?": translate("help"),
  "1": translate("select"),
  "2": translate("junction"),
  "3": translate("pipe"),
  "4": translate("reservoir"),
  "Shift+Enter": translate("simulate"),
  Esc: `${translate("exit")} / ${translate("clearSelection")}`,
  "Command+a": translate("selectAll"),
  "Command+z": translate("undo"),
  "Command+y": translate("redo"),
};

export function CheatsheetDialog() {
  return (
    <>
      <DialogHeader
        title={translate("keyboardShortcuts")}
        titleIcon={KeyboardIcon}
      />
      <div
        className="grid gap-x-3 gap-y-2 pb-1"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        {Object.entries(BINDINGS).map(([key, description]) => (
          <Fragment key={key}>
            <div className="">
              <Keycap>{localizeKeybinding(key)}</Keycap>
            </div>
            <div>{description}</div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
