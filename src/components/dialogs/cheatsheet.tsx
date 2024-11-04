import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "src/components/dialog";
import { Keycap } from "src/components/elements";
import { getIsMac, localizeKeybinding } from "src/lib/utils";
import React, { Fragment } from "react";
import { translate } from "src/infra/i18n";

export const SEARCH_KEYBINDING = "Command+k";

const BINDINGS = {
  "?": translate("help"),
  "1": translate("select"),
  "2": translate("junction"),
  "3": translate("pipe"),
  Esc: `${translate("exit")} / ${translate("clearSelection")}`,
  "Command+a": translate("selectAll"),
  "Command+z": translate("undo"),
  "Command+y": translate("redo"),
};

export function CheatsheetDialog() {
  const isMac = getIsMac();
  return (
    <>
      <DialogHeader
        title={translate("cheatsheet")}
        titleIcon={QuestionMarkCircledIcon}
      />
      <div className="font-bold pb-2">{translate("keyboardShortcuts")}</div>
      <div className="p-1 pb-10">
        <div
          className="grid gap-x-3 gap-y-2"
          style={{
            gridTemplateColumns: "min-content 1fr",
          }}
        >
          {Object.entries(BINDINGS).map(([key, description]) => (
            <Fragment key={key}>
              <div className="">
                <Keycap>{localizeKeybinding(key, isMac)}</Keycap>
              </div>
              <div>{description}</div>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="p-1 pb-10">
        <div className="font-bold pb-2">Mouse controls</div>
        <ul className="space-y-2">
          <li>
            <span className="font-bold">Click</span> to select a feature.
          </li>
          <li>
            Hold down <span className="font-bold">Shift</span> while drawing
            lines or polygons to draw with right angles.
          </li>
          <li>
            <span className="font-bold">Shift-click</span> to select additional
            features.
          </li>
          <li>
            <span className="font-bold">Shift-click and drag</span> to select
            features using the rectangular lasso tool.
          </li>
          <li>
            <span className="font-bold">Right-click</span> on a feature to
            transform, delete, or inspect it.
          </li>
          <li>
            Hold down the <span className="font-bold">Space bar</span> and drag
            to move features.
          </li>
          <li>
            When a feature is already selected, shift-click and shift-click-drag
            will select vertexes from that feature.
          </li>
        </ul>
      </div>
    </>
  );
}
