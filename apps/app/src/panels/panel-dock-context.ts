import { createContext, useContext } from "react";
import type { Dock } from "./docks";

export const PanelDockContext = createContext<Dock | undefined>(undefined);

export const useSideTowardMap = (): "left" | "right" | "top" => {
  const dock = useContext(PanelDockContext);
  if (dock === "vertical" || dock === "bottom") return "top";
  return dock === "left" ? "right" : "left";
};
