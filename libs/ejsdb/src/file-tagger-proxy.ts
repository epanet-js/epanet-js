import { proxy, transfer } from "comlink";
import type { FileTagger } from "@epanet-js/ejsdb-tag";

export const proxyFileTagger = (tagger: FileTagger): FileTagger =>
  proxy({
    tag: async (database, label) => {
      const file = await tagger.tag(database, label);
      return transfer(file, [file.buffer]);
    },
    verify: async (file) => {
      const verdict = await tagger.verify(file);
      return transfer(verdict, [verdict.body.buffer]);
    },
  });
