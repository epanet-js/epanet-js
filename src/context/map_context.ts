import { createContext } from "react";
import type PMap from "src/lib/pmap";

export const MapContext = createContext<PMap | null>(null);
