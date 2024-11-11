import { createContext } from "react";
import { MapEngine } from "src/map/map-engine";

export const MapContext = createContext<MapEngine | null>(null);
