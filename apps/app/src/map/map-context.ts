import { createContext } from "react";
import { MapEngine } from "./map-engine";

export const MapContext = createContext<MapEngine | null>(null);
