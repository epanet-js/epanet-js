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
  minorLoss: "Coef. de pérdidas",
  property: "Propiedad",
  value: "Valor",
  status: "Estado",
  open: "Abierta",
  closed: "Cerrada",
  head: "Carga",
  simulate: "Simular",
  simulationSuccess: "Simulación exitosa",
  simulationFailure: "Simulación con errores",
  simulationOutdated: "Simulación desactualizada",
  runningSimulation: "Ejecutando simulación",
};

export const units: UnitsLocale = {
  ...englishUnits,
};
