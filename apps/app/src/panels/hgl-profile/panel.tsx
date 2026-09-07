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
    if (get(ephemeralStateAtom).type === "hglProfile") {
      set(ephemeralStateAtom, { type: "none" });
    }
    if (get(modeAtom).mode === Mode.HGL_PROFILE) {
      set(modeAtom, { mode: Mode.NONE });
    }
  },
  onClose: ({ set, userTracking }) => {
    set(hglProfileAtom, null);
    userTracking.capture({ name: "profileView.closed", source: "tab" });
  },
};
