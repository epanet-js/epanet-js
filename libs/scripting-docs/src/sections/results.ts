import { memberOf, propertyOf } from "../members";
import type { InterfaceDef, Section } from "../types";

export const INTERFACES: InterfaceDef[] = [
  {
    name: "SimulationResult",
    path: "results",
    summary:
      "The simulation the user last ran, as it was when the script started.",
  },
];

const results = memberOf("SimulationResult");
const resultsProperty = propertyOf("SimulationResult");

export const SECTION: Section = {
  id: "results",
  number: "1.9",
  title: "Simulation results",
  intro:
    "Results come from the simulation the user last ran from the toolbar, read as it was when the script started. Scripts cannot run a simulation themselves.\n\nRead them from the asset: `junction.results.pressure`, `pipe.results.flow`, documented with each asset type in Assets. That covers most scripts, and looping over every asset reads the timestep once. `results` is the timestep the user had selected in the app; `results.at(i)` and `results.series(property)` reach the asset's other timesteps, and a node's `stats` and a pump's `energy` cover the whole run.\n\nUse `network.results` for the run as a whole: whether it succeeded and is still current (`status`, `isStale`), its `timesteps` and the one the app shows (`currentStep`), and the lowest and highest values across the network (`minValues`, `maxValues`), which read the stored results directly instead of looping over assets.",
  types: [
    {
      name: "SimulationStatus",
      definition:
        'type SimulationStatus = "success" | "warning" | "failure" | "stopped";',
      summary:
        "How the run ended. A `failure` or a `stopped` run has no timesteps; `report` says why.",
    },
  ],
  members: [
    memberOf("Network")({
      name: "results",
      signature: "readonly results: SimulationResult | null",
      summary:
        "The simulation the user last ran from the toolbar, or `null` when there is none.",
      description:
        "The run as a whole; for one asset at the selected timestep, read `asset.results`. Results are matched to assets by identity, not by label. An asset the run did not include — inactive, or added since — reads as `null`. Check `isStale` before trusting the numbers.",
      examples: [
        {
          code: `const res = network.results;
if (!res) throw new Error("Run a simulation first");
if (res.isStale) console.warn("The results are from before the last change to the model");
console.log(res.status, res.stepCount, "timesteps");`,
        },
      ],
    }),
    resultsProperty(
      "status",
      "SimulationStatus",
      "How the run ended: `success`, `warning`, `failure` or `stopped`.",
    ),
    resultsProperty(
      "report",
      "string",
      "The EPANET report of the run, with its warnings and errors.",
    ),
    resultsProperty(
      "isStale",
      "boolean",
      "Whether the model or the simulation settings changed after the run, so the results describe an earlier model.",
    ),
    resultsProperty(
      "timesteps",
      "number[]",
      "Seconds from the start, one per reported timestep; `[0]` for a steady-state run, empty when the run has no results.",
    ),
    resultsProperty(
      "stepCount",
      "number",
      "How many timesteps the run reported.",
    ),
    results({
      name: "currentStep",
      signature: "readonly currentStep: number | null",
      summary:
        "The index in `timesteps` of the timestep the user had selected in the app when the script started — the one `asset.results` reads. `null` when the run has no timesteps.",
      examples: [
        {
          code: `const res = network.results;
if (res && res.currentStep !== null) console.log("Reading the results at", res.timesteps[res.currentStep] / 3600, "h");`,
        },
      ],
    }),
    results({
      name: "minValues",
      signature:
        'minValues(property: "pressure" | "head"): Map<string, number>',
      summary:
        "Label → lowest value over the run for every node. The network-wide form of `node.results.stats`, with the same numbers.",
      description:
        "Both list every node. Like `node.results.stats`, the engine tracks these at every hydraulic step, not only the reported timesteps. A node the run did not include is left out; the map is empty when the run has no timesteps.",
      throws: [
        "a property other than `pressure` or `head`",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const low = [...network.results.minValues("pressure")]
  .filter(([, p]) => p < 20)
  .map(([label]) => label);
console.log(low.length, "nodes drop below 20", network.units.pressure);`,
        },
      ],
    }),
    results({
      name: "maxValues",
      signature:
        'maxValues(property: "pressure" | "head"): Map<string, number>',
      summary:
        "Label → highest value over the run for every node. The same rules as `minValues`.",
      throws: [
        "a property other than `pressure` or `head`",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const high = [...network.results.maxValues("pressure")]
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5);
console.table(high.map(([node, pressure]) => ({ node, pressure })));`,
        },
      ],
    }),
  ],
};
