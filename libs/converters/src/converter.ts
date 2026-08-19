import type { ParseNetworkData } from "./parser";

export type Converter = {
  name: string;
  extensions: string[];
  parseNetworkData: ParseNetworkData;
};
