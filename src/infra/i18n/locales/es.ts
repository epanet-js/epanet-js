import { Translations, UnitsLocale } from "./locale";
import { units as englishUnits } from "./en";

export const translations: Translations = {
  select: "Seleccionar",
  junction: "Nudo",
  pipe: "Tubería",
  reservoir: "Embalse",
  hintPipeDrawStart:
    "Haz click para empezar un tubería, después haz click para añadir vértices.",
  hintPipeDrawEnd: "Finaliza una tubería con doble click o apretando Enter.",
  keyboardShortcuts: "Atajos de teclado",
  help: "Ayuda",
  exit: "Terminar",
  clearSelection: "Borrar selección",
  selectAll: "Seleccionar todo",
  undo: "Deshacer",
  redo: "Rehacer",
  cheatsheet: "Guía rápida",
  diameter: "Diametro",
  length: "Longitud",
  demand: "Consumo",
  elevation: "Elevación",
  roughness: "Rugosidad",
  property: "Propiedad",
  value: "Valor",
  status: "Estado",
  open: "Abierta",
  closed: "Cerrada",
};

export const units: UnitsLocale = {
  ...englishUnits,
};
