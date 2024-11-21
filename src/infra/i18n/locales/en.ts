import { Unit } from "src/quantity";

export const translations = {
  select: "Select",
  junction: "Junction",
  pipe: "Pipe",
  hintPipeDrawStart: "Click to start the pipe, then click to add each vertex.",
  hintPipeDrawEnd: "End a pipe by double-clicking or hitting Enter.",
  keyboardShortcuts: "Keyboard shortcuts",
  help: "Help",
  exit: "Exit",
  clearSelection: "Clear selection",
  selectAll: "Select all",
  undo: "Undo",
  redo: "Redo",
  cheatsheet: "Cheatsheet",
  diameter: "Diameter",
  length: "Length",
  demand: "Demand",
  elevation: "Elevation",
  roughnessCM: "Roughness",
  roughnessDW: "Roughness",
  roughnessHW: "Roughness",
  property: "Property",
  value: "Value",
};

export const units: Record<Exclude<Unit, null>, string> = {
  m: "m",
  mm: "mm",
  in: "in",
  ft: "ft",
  "l/s": "l/s",
  "l/h": "l/h",
  km: "km",
  "gal/min": "gpm",
};
