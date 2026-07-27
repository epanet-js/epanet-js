import { createContext } from "react";
import { MapEngine } from "@epanet-js/map";

export const MapContext = createContext<MapEngine | null>(null);
