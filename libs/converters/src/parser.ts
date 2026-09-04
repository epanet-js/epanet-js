import type { NetworkData } from "./network-data";
import type { Issue } from "./issues";
import type { ParserInput } from "./source-file";

export type ParserResult = {
  network: NetworkData;
  issues: Issue[];
};

export type ParseNetworkData = (input: ParserInput) => Promise<ParserResult>;
