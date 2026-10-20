import { memberOf } from "../members";
import type { Section } from "../types";

export const SECTION: Section = {
  id: "export",
  number: "1.8",
  title: "Export",
  members: [
    memberOf("Network")({
      name: "toInp",
      signature: "toInp(): string",
      summary:
        "The network as INP text, built the way File › Export INP builds it, from the model the script reads.",
      description:
        "Coordinates, label ids, customer demands and water quality are included. When the model needs **EPANET-LSX** — it has remote set-point PRVs or variable-speed pump controls — `toInp()` logs a console warning naming those assets. The file then carries a `[SCRIPT]` section that standard EPANET cannot run.",
      examples: [
        { code: 'ui.attachFile(network.name + ".inp", network.toInp());' },
      ],
    }),
  ],
};
