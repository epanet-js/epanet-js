import { getWorker, proxyFileTagger } from "@epanet-js/ejsdb";
import type { FileTagger } from "@epanet-js/ejsdb-tag";

export const setDbFileTagger = (tagger: FileTagger): Promise<void> =>
  getWorker().setFileTagger(proxyFileTagger(tagger));
