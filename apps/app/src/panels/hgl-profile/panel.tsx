import type { TranslateFn } from "src/hooks/use-translate";
import { ephemeralStateAtom } from "src/state/drawing";
import { hglProfileAtom } from "src/state/hgl-profile";
import { Mode, modeAtom } from "src/state/mode";
import type { PanelTemplate } from "src/panels/panel-template";
import { HglProfilePanel } from "./index";

export const hglProfilePanel: PanelTemplate<"hgl-profile"> = {
  component: () => <HglProfilePanel />,
  buildLabel: (_panel, translate: TranslateFn) => translate("hglProfile.title"),
  onDeactivate: ({ get, set }) => {
    if (get(modeAtom).mode !== Mode.HGL_PROFILE) return;
    set(modeAtom, { mode: Mode.NONE });
  },
  onClose: ({ get, set, userTracking }) => {
    set(hglProfileAtom, null);
    if (get(ephemeralStateAtom).type === "hglProfile") {
      set(ephemeralStateAtom, { type: "none" });
    }
    userTracking.capture({ name: "profileView.closed", source: "tab" });
  },
};
