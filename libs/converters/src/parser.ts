import type { NetworkData } from "./network-data";
import type { ParserIssue } from "./issues";
import type { ParserInput } from "./source-file";

export type ParserResult = {
  network: NetworkData;
  issues: ParserIssue[];
};

export type ParseNetworkData = (input: ParserInput) => Promise<ParserResult>;
