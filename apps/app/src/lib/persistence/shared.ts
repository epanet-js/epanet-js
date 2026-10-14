import { isDebugOn } from "src/infra/debug-mode";
import type { ChangeSet } from "@epanet-js/change-set";

export function trackChangeSet(changeSet: ChangeSet) {
  if (isDebugOn) {
    // eslint-disable-next-line no-console
    console.log(
      "TRANSACT",
      JSON.stringify({ name: changeSet.name, summary: changeSet.summary() }),
    );
  }
}
