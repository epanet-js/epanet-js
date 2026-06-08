import { focusAtom } from "jotai-optics";
import { dataAtom } from "src/state/data";

export const selectionAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("selection"),
);
