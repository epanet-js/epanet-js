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
    "`network.lastResults` is the simulation the user last ran from the toolbar, read as it was when the script started. Scripts cannot run a simulation themselves.",
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
  ],
  members: [
    memberOf("Network")({
      name: "lastResults",
      signature: "readonly lastResults: SimulationResult | null",
      summary:
        "The simulation the user last ran from the toolbar, or `null` when there is none.",
      description:
        "Results are matched to assets by identity, not by label. An asset the run did not include — inactive, or added since — reads as `null`. Check `isStale` before trusting the numbers.",
      examples: [
        {
          code: `const res = network.lastResults;
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
      signature: "at(index: number): Promise<StepResult>",
      summary:
        "One timestep, read from the stored results when you ask for it — `await` it. A negative index counts from the end: `at(-1)` is the last.",
      throws: [
        "`No results available` when the run has no timesteps",
        "an index outside the run",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const last = await network.lastResults.at(-1);
console.log(last.time / 3600, "h:", last.node("J1").pressure, network.units.pressure);`,
        },
      ],
    }),
    results({
      name: "nodeSeries",
      signature:
        "nodeSeries(ref: NodeAsset | string, property: string): Promise<number[] | null>",
      summary:
        "One node's property across the run, one value per entry of `timesteps` — `await` it. Reads only that node, so it is the way to follow one asset over time.",
      description:
        "The property is one the node's type reports in `NodeStepValues`. `null` when the run did not include the node, or did not analyse that water quality.",
      throws: [
        "a label no node has, or a link",
        "a property the node's type does not report",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const res = network.lastResults;
const pressures = await res.nodeSeries("J1", "pressure");
const lowest = Math.min(...pressures);
console.log("J1 drops to", lowest, network.units.pressure, "at", res.timesteps[pressures.indexOf(lowest)] / 3600, "h");`,
        },
      ],
    }),
    results({
      name: "linkSeries",
      signature:
        "linkSeries(ref: LinkAsset | string, property: string): Promise<number[] | null>",
      summary:
        "One link's property across the run, one value per entry of `timesteps` — `await` it. A link's `status` is not a number and has no series; read it with `step.link`.",
      description:
        "The property is one the link's type reports in `LinkStepValues`. `null` when the run did not include the link, or did not analyse that water quality.",
      throws: [
        "a label no link has, or a node",
        "a property the link's type does not report",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const flows = await network.lastResults.linkSeries("P1", "flow");
const reversals = flows.filter((flow, i) => i > 0 && Math.sign(flow) !== Math.sign(flows[i - 1])).length;
console.log("P1 reverses", reversals, "times");`,
        },
      ],
    }),
    results({
      name: "nodeStats",
      signature:
        "nodeStats(ref: NodeAsset | string): Promise<{ minPressure: number; maxPressure: number; minHead: number; maxHead: number } | null>",
      summary:
        "A node's lowest and highest pressure and head over the run, in `network.units.pressure` and `network.units.head` — `await` it.",
      description:
        "The engine tracks these at every hydraulic step, including the ones it takes between reported timesteps — when a control fires or a tank fills — so they can be beyond anything `nodeSeries` shows. `null` when the run did not include the node or has no timesteps.",
      throws: [
        "a label no node has, or a link",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const low = [];
for (const junction of network.junctions) {
  const stats = await network.lastResults.nodeStats(junction);
  if (stats && stats.minPressure < 20) low.push(junction);
}
console.log(low.length, "junctions drop below 20", network.units.pressure);`,
        },
      ],
    }),
    results({
      name: "minValues",
      signature:
        'minValues(property: "pressure" | "head"): Promise<Map<string, number>>',
      summary:
        "Label → lowest value over the run for every node — `await` it. The network-wide form of `nodeStats`, with the same numbers.",
      description:
        "`pressure` lists junctions and tanks, `head` every node. Like `nodeStats`, the engine tracks these at every hydraulic step, not only the reported timesteps. A node the run did not include is left out; the map is empty when the run has no timesteps.",
      throws: [
        "a property other than `pressure` or `head`",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const low = [...(await network.lastResults.minValues("pressure"))]
  .filter(([, p]) => p < 20)
  .map(([label]) => label);
console.log(low.length, "nodes drop below 20", network.units.pressure);`,
        },
      ],
    }),
    results({
      name: "maxValues",
      signature:
        'maxValues(property: "pressure" | "head"): Promise<Map<string, number>>',
      summary:
        "Label → highest value over the run for every node — `await` it. The same rules as `minValues`.",
      throws: [
        "a property other than `pressure` or `head`",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `const high = [...(await network.lastResults.maxValues("pressure"))]
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5);
console.table(high.map(([node, pressure]) => ({ node, pressure })));`,
        },
      ],
    }),
    results({
      name: "pumpEnergy",
      signature: `pumpEnergy(ref: Pump | string): Promise<{
  utilization: number;
  averageEfficiency: number;
  averageKwPerFlowUnit: number;
  averageKw: number;
  peakKw: number;
  averageCostPerDay: number;
  demandCharge: number;
} | null>`,
      summary:
        "A pump's energy use over the run, as EPANET reports it — `await` it.",
      description:
        "`utilization` and `averageEfficiency` are in `units.efficiency`, `averageKw` and `peakKw` in `units.power`, `averageKwPerFlowUnit` in `units.averageKwPerFlowUnit`; `averageCostPerDay` and `demandCharge` are in the project's currency. `demandCharge` is the network's, the same for every pump. `null` when the run did not include the pump, has no timesteps or reported no energy.",
      throws: [
        "a label no link has, or a link that is not a pump",
        "`The simulation results are no longer available; run the simulation again` when a newer run has replaced the stored results",
      ],
      examples: [
        {
          code: `for (const pump of network.pumps) {
  const energy = await network.lastResults.pumpEnergy(pump);
  if (energy) console.log(pump.label, energy.averageKw, network.units.power, "on", energy.utilization, network.units.efficiency, "of the time");
}`,
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
          code: `const step = await network.lastResults.at(0);
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
          code: `const flow = (await network.lastResults.at(0)).link("P1").flow;
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
          code: `const pressures = (await network.lastResults.at(-1)).values("pressure");
const low = [...pressures].filter(([, p]) => p < 20).map(([label]) => label);
console.log(low.length, "of", pressures.size, "nodes below 20", network.units.pressure);`,
        },
      ],
    }),
  ],
};
