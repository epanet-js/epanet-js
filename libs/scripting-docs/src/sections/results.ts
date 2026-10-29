import { memberOf, propertyOf } from "../members";
import type { InterfaceDef, Section } from "../types";

export const INTERFACES: InterfaceDef[] = [
  {
    name: "SimulationResult",
    path: "results",
    summary:
      "The simulation the user last ran, as it was when the script started.",
  },
  {
    name: "StepResult",
    path: "step",
    summary: "One timestep of a simulation's results.",
  },
];

const results = memberOf("SimulationResult");
const resultsProperty = propertyOf("SimulationResult");
const step = memberOf("StepResult");

export const SECTION: Section = {
  id: "results",
  number: "1.9",
  title: "Simulation results",
  intro:
    "Results come from the simulation the user last ran from the toolbar, read as it was when the script started. Scripts cannot run a simulation themselves.\n\nRead them from the asset when the question is about assets at the timestep the user is looking at: `junction.results.pressure`, `pipe.results.flow`. That covers most scripts, and looping over every asset reads the timestep once. `asset.results.at(i)` and `asset.results.series(property)` reach other timesteps of the same asset, and a node's `stats` and a pump's `energy` cover the whole run.\n\nUse `network.results` for the run as a whole: whether it succeeded and is still current (`status`, `isStale`), its `timesteps`, every asset's value at a timestep in one map (`at(i).values`), and the lowest and highest values across the network (`minValues`, `maxValues`). Those read the stored results directly, so prefer them to looping over assets for anything beyond the current timestep.",
  types: [
    {
      name: "SimulationStatus",
      definition:
        'type SimulationStatus = "success" | "warning" | "failure" | "stopped";',
      summary:
        "How the run ended. A `failure` or a `stopped` run has no timesteps; `report` says why.",
    },
    {
      name: "NodeStepValues",
      definition: `interface NodeStepValues {
  /** junctions and tanks */
  pressure?: number;
  head: number;
  /** junctions */
  demand?: number;
  /** tanks */
  level?: number;
  volume?: number;
  /** tanks and reservoirs */
  netFlow?: number;
  /** when the run had that water quality analysis */
  waterAge?: number;
  waterTrace?: number;
  chemicalConcentration?: number;
}`,
      summary:
        "One node's values at one timestep. The fields depend on the node's type.",
      description:
        "Values are in the project's units: `network.units[name]`, except a junction's `demand`, which is in `units.actualDemand`.",
    },
    {
      name: "LinkStepValues",
      definition: `interface LinkStepValues {
  flow: number;
  /** pipes and valves */
  velocity?: number;
  headloss?: number;
  /** pipes */
  unitHeadloss?: number;
  /** pumps */
  head?: number;
  /** pipe: "open" | "closed"; pump: "on" | "off"; valve: "active" | "open" | "closed" */
  status: string;
  /** pumps and valves */
  statusWarning?: "cannot-deliver-flow" | "cannot-deliver-pressure" | "cannot-deliver-head" | null;
  /** when the run had that water quality analysis */
  waterAge?: number;
  waterTrace?: number;
  chemicalConcentration?: number;
}`,
      summary:
        "One link's values at one timestep. The fields depend on the link's type.",
      description:
        "Values are in the project's units: `network.units[name]`, except a pump's `head`, which is in `units.actualHead`. A positive `flow` runs from the start node to the end node.",
    },
    {
      name: "NodeResults",
      definition: `interface NodeResults extends NodeStepValues {
  /** this node at another timestep; a negative index counts from the end */
  at(index: number): NodeResults | null;
  /** this node's property across the run, one value per entry of network.results.timesteps */
  series(property: string): number[] | null;
  /** this node's lowest and highest pressure and head over the run; the same at every timestep */
  readonly stats: { minPressure: number; maxPressure: number; minHead: number; maxHead: number } | null;
}`,
      summary:
        "A node's values at one timestep, with the way to its other timesteps.",
    },
    {
      name: "LinkResults",
      definition: `interface LinkResults extends LinkStepValues {
  /** this link at another timestep; a negative index counts from the end */
  at(index: number): LinkResults | null;
  /** this link's property across the run, one value per entry of network.results.timesteps; status has no series */
  series(property: string): number[] | null;
  /** pumps: this pump's energy use over the run, as EPANET reports it; the same at every timestep */
  readonly energy?: {
    utilization: number;
    averageEfficiency: number;
    averageKwPerFlowUnit: number;
    averageKw: number;
    peakKw: number;
    averageCostPerDay: number;
    demandCharge: number;
  } | null;
}`,
      summary:
        "A link's values at one timestep, with the way to its other timesteps.",
    },
  ],
  members: [
    memberOf("NodeAsset")({
      name: "results",
      signature: "readonly results: NodeResults | null",
      summary:
        "This node's values at the timestep the user had selected in the app when the script started.",
      description:
        "`null` when there is no simulation, the run has no timesteps, or it did not include this node — inactive, or added since. Check `network.results.isStale` before trusting the numbers. `series` takes a property the node's type reports in `NodeStepValues`.\n\n`stats` is in `network.units.pressure` and `network.units.head`. The engine tracks it at every hydraulic step, including the ones it takes between reported timesteps — when a control fires or a tank fills — so it can be beyond anything `series` shows.",
      throws: [
        "`at` with an index outside the run",
        "`series` with a property the node's type does not report",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const low = network.junctions.filter((junction) => junction.results?.pressure < 20);
console.log(low.length, "junctions below 20", network.units.pressure, "at the selected timestep");`,
        },
        {
          code: `const j1 = network.getNode("J1");
if (j1.results) console.log("J1:", j1.results.pressure, "now,", j1.results.at(-1).pressure, "at the end,", Math.min(...j1.results.series("pressure")), "at its lowest reported timestep");`,
        },
        {
          code: `const low = network.junctions.filter((junction) => junction.results?.stats?.minPressure < 20);
console.log(low.length, "junctions drop below 20", network.units.pressure, "during the run");`,
        },
      ],
    }),
    memberOf("LinkAsset")({
      name: "results",
      signature: "readonly results: LinkResults | null",
      summary:
        "This link's values at the timestep the user had selected in the app when the script started.",
      description:
        "`null` when there is no simulation, the run has no timesteps, or it did not include this link — inactive, or added since. Check `network.results.isStale` before trusting the numbers. `series` takes a property the link's type reports in `LinkStepValues`, other than `status`.\n\nA pump's `energy` has `utilization` and `averageEfficiency` in `units.efficiency`, `averageKw` and `peakKw` in `units.power`, `averageKwPerFlowUnit` in `units.averageKwPerFlowUnit`; `averageCostPerDay` and `demandCharge` are in the project's currency. `demandCharge` is the network's, the same for every pump. `energy` is `null` when the run reported no energy; other links have no `energy`.",
      throws: [
        "`at` with an index outside the run",
        "`series` with a property the link's type does not report",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const closed = network.pipes.filter((pipe) => pipe.results?.status === "closed");
console.log(closed.length, "pipes closed at the selected timestep");`,
        },
        {
          code: `const flows = network.getLink("P1").results?.series("flow") ?? [];
console.log("P1 peaks at", Math.max(...flows.map(Math.abs)), network.units.flow);`,
        },
        {
          code: `for (const pump of network.pumps) {
  const energy = pump.results?.energy;
  if (energy) console.log(pump.label, energy.averageKw, network.units.power, "on", energy.utilization, network.units.efficiency, "of the time");
}`,
        },
      ],
    }),
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
      name: "at",
      signature: "at(index: number): StepResult",
      summary:
        "One timestep, read from the stored results when you ask for it. A negative index counts from the end: `at(-1)` is the last.",
      throws: [
        "`No results available` when the run has no timesteps",
        "an index outside the run",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const last = network.results.at(-1);
console.log(last.time / 3600, "h:", last.node("J1").pressure, network.units.pressure);`,
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
        "`pressure` lists junctions and tanks, `head` every node. Like `node.results.stats`, the engine tracks these at every hydraulic step, not only the reported timesteps. A node the run did not include is left out; the map is empty when the run has no timesteps.",
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
    step({
      name: "time",
      signature: "readonly time: number",
      summary: "Seconds from the start of the run.",
    }),
    step({
      name: "node",
      signature: "node(ref: NodeAsset | string): NodeStepValues | null",
      summary:
        "One node's values at this timestep, by node or label; `null` when the run did not include it.",
      throws: ["a label no node has, or a link"],
      examples: [
        {
          code: `const step = network.results.at(0);
console.log(step.node("J1"));`,
        },
      ],
    }),
    step({
      name: "link",
      signature: "link(ref: LinkAsset | string): LinkStepValues | null",
      summary:
        "One link's values at this timestep, by link or label; `null` when the run did not include it.",
      throws: ["a label no link has, or a node"],
      examples: [
        {
          code: `const flow = network.results.at(0).link("P1").flow;
console.log("P1 carries", Math.abs(flow), network.units.flow);`,
        },
      ],
    }),
    step({
      name: "values",
      signature:
        'values(property: string, options?: { of?: "nodes" | "links" }): Map<string, number>',
      summary:
        "Label → value at this timestep for every node or link that reports the property — use it for network-wide scans.",
      description:
        '`head`, `waterAge`, `waterTrace` and `chemicalConcentration` are reported by nodes and links alike, so they need `{ of: "nodes" }` or `{ of: "links" }`. A link\'s `status` is not a number and is not listed; read it with `step.link`.',
      throws: [
        "a property neither nodes nor links report",
        "a property nodes and links both report, without `of`",
      ],
      examples: [
        {
          code: `const pressures = network.results.at(-1).values("pressure");
const low = [...pressures].filter(([, p]) => p < 20).map(([label]) => label);
console.log(low.length, "of", pressures.size, "nodes below 20", network.units.pressure);`,
        },
      ],
    }),
  ],
};
