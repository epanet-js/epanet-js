import type { ExampleScript } from "./types";

export const exampleScripts: ExampleScript[] = [
  {
    id: "select-small-pipes",
    name: "Select small pipes",
    source: `// ---- inputs ----------------------------------------------------------
const MAX_DIAMETER = 100; // select pipes at or below this (project units)
// ----------------------------------------------------------------------

const small = network.pipes.filter((p) => p.diameter <= MAX_DIAMETER);
console.log(\`\${small.length} of \${network.pipes.length} pipes at or below \${MAX_DIAMETER}\`);
if (small.length === 0) throw new Error("Nothing matched — raise MAX_DIAMETER");

// Selection is how a script hands results back: selected assets render
// purple on the map when the run finishes.
selection.set(small);
map.zoomTo(small);
`,
  },
  {
    id: "export-pipes-csv",
    name: "Export pipes to CSV",
    source: `const pipes = network.pipes;
const rows = ["label,diameter,length,start,end"];
for (const [i, p] of pipes.entries()) {
  ui.progress(i / pipes.length);
  rows.push([p.label, p.diameter, p.length, p.startNode.label, p.endNode.label].join(","));
}
ui.progress(1);

console.log(\`\${pipes.length} pipes · diameter in \${network.units.diameter}\`);
ui.attachFile("pipes.csv", rows.join("\\n"));
`,
  },
  {
    id: "select-in-view",
    name: "Select what's in view",
    source: `// ---- inputs ----------------------------------------------------------
const TYPE = null; // e.g. "pipe" to select only pipes
// ----------------------------------------------------------------------

if (!map.bounds) throw new Error("The map isn't available");
const [minLng, minLat, maxLng, maxLat] = map.bounds;
const inView = ([lng, lat]) =>
  lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;

// A link counts only when all of it is in view.
const assets = network.assets.filter(
  (a) =>
    (TYPE === null || a.type === TYPE) &&
    (a.isNode ? inView(a.coordinates) : a.geometry.coordinates.every(inView)),
);
console.log(\`\${assets.length} assets in view\`);
selection.set(assets);
`,
  },
  {
    id: "expand-selection",
    name: "Expand selection by one hop",
    source: `if (selection.isEmpty) throw new Error("Select some assets first");
const start = selection.assets;

const expanded = new Set(start);
for (const asset of start) {
  const links = asset.isNode ? asset.links : [asset];
  for (const link of links) {
    expanded.add(link);
    expanded.add(link.startNode);
    expanded.add(link.endNode);
  }
}

const counts = {};
for (const asset of expanded) {
  counts[asset.type] = (counts[asset.type] ?? 0) + 1;
}
console.log(\`\${start.length} → \${expanded.size} assets\`);
console.table(Object.entries(counts).map(([type, count]) => ({ type, count })));

selection.set([...expanded]);
map.zoomTo([...expanded]);
`,
  },
  {
    id: "trace-zone",
    name: "Trace the zone around the selection",
    source: `// Same walk as the Trace tool's boundary mode: it stops at tanks,
// reservoirs, pumps, closed links and valves other than open TCVs.
if (selection.isEmpty) throw new Error("Select a junction or a pipe to start from");

const zone = network.trace(selection.assets);
console.log(\`\${zone.nodes.length} nodes · \${zone.links.length} links · \${zone.boundaryLinks.length} on the edge\`);
console.table(
  zone.boundaryLinks.map((b) => ({
    link: b.link,
    type: b.link.type,
    inside: b.inside,
    outside: b.outside,
  })),
);

const assets = [...zone.nodes, ...zone.links];
selection.set(assets);
map.zoomTo(assets);
`,
  },
  {
    id: "check-prv-targets",
    name: "Check PRV target nodes",
    source: `// A PRV with a target node holds its setting at that node. The target
// should sit downstream of the valve; one that no longer does is flagged.
const prvs = network.valves.filter((v) => v.kind === "prv");
if (prvs.length === 0) throw new Error("This network has no PRVs");

const stale = [];
const rows = prvs.map((prv) => {
  const target = prv.targetNode;
  const downstream = network.trace(prv.endNode).nodes;
  const isDownstream = target === null ? null : downstream.includes(target);
  if (isDownstream === false) stale.push(prv);
  return {
    prv,
    target: target ?? "",
    options: prv.targetNodeOptions().length,
    downstream: isDownstream ?? "",
  };
});

console.table(rows);
if (stale.length > 0) {
  console.warn(\`\${stale.length} of \${prvs.length} PRVs target a node that is no longer downstream\`);
  selection.set(stale);
  map.zoomTo(stale);
} else {
  console.log(\`All \${prvs.length} PRVs are fine\`);
}
`,
  },
  {
    id: "find-orphan-assets",
    name: "Find orphan assets",
    source: `// The Network Review's orphan check: nodes with no links, links missing
// an end, and pumps or valves with nothing else connected at either end.
// Inactive assets are left out, as they are left out of the simulation.
const orphans = network.findOrphanAssets();
if (orphans.length === 0) {
  console.log("No orphan assets");
} else {
  console.warn(\`\${orphans.length} orphan assets\`);
  console.table(orphans.map((asset) => ({ asset, type: asset.type })));
  selection.set(orphans);
  map.zoomTo(orphans);
}
`,
  },
  {
    id: "find-unsupplied-areas",
    name: "Find unsupplied areas",
    source: `// The Network Review's connectivity check: parts of the network that no
// reservoir or tank can reach. Inactive assets are left out, so a closed-off
// stretch shows up as its own area.
const unsupplied = network
  .findSubnetworks()
  .filter((area) => area.supplySourceCount === 0);
if (unsupplied.length === 0) {
  console.log("Every area has a reservoir or tank");
} else {
  console.warn(\`\${unsupplied.length} areas with no reservoir or tank\`);
  console.table(
    unsupplied.map((area, i) => ({
      area: i + 1,
      nodes: area.nodes.length,
      pipes: area.pipeCount,
    })),
  );
  const assets = unsupplied.flatMap((area) => [...area.nodes, ...area.links]);
  selection.set(assets);
  map.zoomTo(assets);
}
`,
  },
  {
    id: "find-proximity-anomalies",
    name: "Find nodes close to pipes",
    source: `// The Network Review's proximity check: nodes that sit within a distance
// of a pipe they are not connected to, nearest first. The distance is in
// the project's length unit; this uses the review panel's default.
const distance = network.units.length === "ft" ? 1.5 : 0.5;
const anomalies = network.findProximityAnomalies({ distance });
if (anomalies.length === 0) {
  console.log(\`No nodes within \${distance} \${network.units.length} of another pipe\`);
} else {
  console.warn(\`\${anomalies.length} nodes close to a pipe they are not connected to\`);
  console.table(
    anomalies.map(({ node, pipe, distance }) => ({
      node,
      pipe,
      distance: distance.toFixed(2),
    })),
  );
  const nodes = anomalies.map((anomaly) => anomaly.node);
  selection.set(nodes);
  map.zoomTo(nodes);
}
`,
  },
  {
    id: "find-crossing-pipes",
    name: "Find crossing pipes",
    source: `// The Network Review's crossing check: pipes that cross on the map with
// no junction where they meet. Each pair lists the smaller pipe first.
const crossings = network.findCrossingPipes();
if (crossings.length === 0) {
  console.log("No crossing pipes");
} else {
  console.warn(\`\${crossings.length} pipe crossings without a junction\`);
  console.table(crossings.map(({ pipe1, pipe2 }) => ({ pipe1, pipe2 })));
  const pipes = [...new Set(crossings.flatMap(({ pipe1, pipe2 }) => [pipe1, pipe2]))];
  selection.set(pipes);
  map.zoomTo(pipes);
}
`,
  },
  {
    id: "zone-summary",
    name: "Summarise each zone",
    source: `// Counts the junctions, pipe length and customer demand inside each zone
// imported with File > Import > Zones. A pipe counts only when all of it is
// inside, so one crossing a boundary is in no zone.
if (zones.count === 0) throw new Error("This project has no zones — import them first");

const rows = zones.list.map((zone) => {
  const inside = network.findWithin(zone.geometry, {
    types: ["junction", "pipe", "customerPoint"],
  });
  const of = (type) => inside.filter((a) => a.type === type);
  return {
    zone,
    junctions: of("junction").length,
    pipeLength: Math.round(of("pipe").reduce((sum, p) => sum + p.length, 0)),
    demand: of("customerPoint").reduce((sum, cp) => sum + cp.demand, 0),
  };
});

console.log(\`\${zones.count} zones · length in \${network.units.length}, demand in \${network.units.customerDemand}\`);
console.table(rows);

const outside = network.junctions.filter((j) => zones.at(j).length === 0);
if (outside.length > 0) {
  console.warn(\`\${outside.length} junctions are in no zone\`);
  selection.set(outside);
  map.zoomTo(outside);
}
`,
  },
  {
    id: "validate-network",
    name: "Check the model will run",
    source: `// The checks behind the dialog that opens when you press Run: orphan
// assets, areas with no reservoir or tank, and attribute rules. Status is
// "ok" when Run goes straight through, "warning" when only warnings are
// left, and "error" otherwise.
const report = network.validate();
if (report.status === "ok") {
  console.log("Ready to run: no issues found");
} else {
  const { errors, warnings } = report.counts;
  console.warn(\`\${report.status}: \${errors} errors, \${warnings} warnings\`);
  console.table(
    report.findings.map((finding) => ({
      severity: finding.severity,
      code: finding.code,
      assets: finding.assets.length,
    })),
  );
  const worst = report.findings[0].assets;
  selection.set(worst);
  map.zoomTo(worst);
}
`,
  },
  {
    id: "pipe-length-by-diameter",
    name: "Pipe length by diameter",
    source: `// Uses the selected pipes, or every pipe when nothing is selected.
const pipes = selection.isEmpty
  ? network.pipes
  : selection.assets.filter((a) => a.type === "pipe");
if (pipes.length === 0) throw new Error("No pipes in the selection");

const byDiameter = new Map();
for (const p of pipes) {
  const row = byDiameter.get(p.diameter) ?? { diameter: p.diameter, pipes: 0, length: 0 };
  row.pipes += 1;
  row.length += p.length;
  byDiameter.set(p.diameter, row);
}

console.log(\`\${pipes.length} pipes · diameter in \${network.units.diameter}, length in \${network.units.length}\`);
console.table(
  [...byDiameter.values()]
    .sort((a, b) => a.diameter - b.diameter)
    .map((row) => ({ ...row, length: Math.round(row.length) })),
);
`,
  },
  {
    id: "demand-by-pattern",
    name: "Demand by pattern",
    source: `// Uses the selected junctions, or every junction when nothing is selected.
const junctions = selection.isEmpty
  ? network.junctions
  : selection.assets.filter((a) => a.type === "junction");
if (junctions.length === 0) throw new Error("No junctions in the selection");

const byPattern = new Map();
const rows = ["junction,base,pattern"];
for (const j of junctions) {
  for (const d of j.demands) {
    const pattern = d.pattern ?? "(none)";
    const row = byPattern.get(pattern) ?? { pattern, junctions: new Set(), base: 0 };
    row.junctions.add(j);
    row.base += d.base;
    byPattern.set(pattern, row);
    rows.push([j.label, d.base, d.pattern ?? ""].join(","));
  }
}

const total = junctions.reduce((sum, j) => sum + j.baseDemand, 0);
console.log(\`\${junctions.length} junctions · total base demand \${total} \${network.units.baseDemand}\`);
console.table(
  [...byPattern.values()].map((row) => ({
    pattern: row.pattern,
    junctions: row.junctions.size,
    base: row.base,
  })),
);
ui.attachFile("junction-demands.csv", rows.join("\\n"));
`,
  },
  {
    id: "count-by-custom-attribute",
    name: "Count by custom attribute",
    source: `// ---- inputs ----------------------------------------------------------
const ATTRIBUTE = "Zone"; // the custom attribute's name, as in the asset panel
const TYPE = "junction"; // the asset type it is defined for
// ----------------------------------------------------------------------

const assets = network.assets.filter((a) => a.type === TYPE);
const counts = new Map();
const missing = [];
for (const asset of assets) {
  const value = asset.getCustom(ATTRIBUTE);
  if (value === null) missing.push(asset);
  const key = value ?? "(empty)";
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
if (missing.length === assets.length) {
  throw new Error(\`No \${TYPE} has a value for "\${ATTRIBUTE}" — check the name\`);
}

console.log(\`\${assets.length} \${TYPE}s · \${missing.length} without "\${ATTRIBUTE}"\`);
console.table([...counts].map(([value, count]) => ({ [ATTRIBUTE]: value, count })));

// Selects the ones still missing a value, so they can be filled in.
if (missing.length > 0) selection.set(missing);
`,
  },
  {
    id: "audit-customer-points",
    name: "Audit customer points",
    source: `// ---- inputs ----------------------------------------------------------
const TOP = 10; // how many of the largest customers to list
// ----------------------------------------------------------------------

const points = network.customerPoints;
if (points.length === 0) throw new Error("This network has no customer points");

// Reads every field of every point, one point at a time.
const rows = ["label,lng,lat,demand,categories,patterns,connected,issue"];
const issues = new Map();
let total = 0;
let lost = 0;
for (const [i, cp] of points.entries()) {
  if (i % 1000 === 0) ui.progress(i / points.length);
  if (network.getCustomerPoint(cp.label) !== cp) {
    throw new Error(\`\${cp.label} is not found by its own label\`);
  }
  const [lng, lat] = cp.geometry.coordinates;
  const patterns = [...new Set(cp.demands.map((d) => d.pattern ?? "(none)"))];

  // A disconnected point is a silent zero in every simulation.
  let issue = "";
  if (!cp.isConnected && cp.demand > 0) issue = "disconnected with demand";
  else if (!cp.isConnected) issue = "disconnected";
  else if (cp.demand === 0) issue = "no demand";
  if (issue) issues.set(issue, (issues.get(issue) ?? 0) + 1);

  total += cp.demand;
  if (!cp.isConnected) lost += cp.demand;
  rows.push(
    [cp.label, lng, lat, cp.demand, cp.demands.length, patterns.join(" "), cp.isConnected, issue].join(","),
  );
}
ui.progress(1);

const unit = network.units.customerDemand;
console.log(\`\${points.length} customer points · total demand \${total} \${unit} · \${lost} \${unit} not reaching the network\`);
if (issues.size > 0) {
  console.table([...issues].map(([issue, count]) => ({ issue, count })));
}
console.table(
  [...points]
    .sort((a, b) => b.demand - a.demand)
    .slice(0, TOP)
    .map((cp) => ({ label: cp.label, demand: cp.demand, connected: cp.isConnected })),
);
ui.attachFile("customer-points.csv", rows.join("\\n"));
`,
  },
  {
    id: "pattern-and-curve-usage",
    name: "Pattern and curve usage",
    source: `// Finds what uses each pattern and curve, and which ones nothing uses.
const patternUses = new Map(network.patterns.map((p) => [p.label, []]));
const curveUses = new Map(network.curves.map((c) => [c.label, []]));

const use = (uses, find, label, by) => {
  if (label === null) return;
  const item = find(label);
  if (!item) throw new Error(\`\${by} uses "\${label}", which is not in the library\`);
  uses.get(item.label).push(by);
};
const usePattern = (label, by) => use(patternUses, network.getPattern, label, by);
const useCurve = (label, by) => use(curveUses, network.getCurve, label, by);

const total = network.assets.length + network.customerPoints.length;
let done = 0;
const step = () => {
  if (++done % 1000 === 0) ui.progress(done / total);
};
for (const node of network.nodes) {
  step();
  usePattern(node.chemicalSourcePattern, \`\${node.label} quality source\`);
  if (node.type === "junction") {
    for (const d of node.demands) usePattern(d.pattern ?? null, \`\${node.label} demand\`);
  }
  if (node.type === "reservoir") usePattern(node.headPattern, \`\${node.label} head\`);
  if (node.type === "tank") useCurve(node.volumeCurve, \`\${node.label} volume\`);
}
for (const link of network.links) {
  step();
  if (link.type === "pump") {
    usePattern(link.speedPattern, \`\${link.label} speed\`);
    usePattern(link.energyPricePattern, \`\${link.label} energy price\`);
    useCurve(link.curve, \`\${link.label} curve\`);
    useCurve(link.efficiencyCurve, \`\${link.label} efficiency\`);
  }
  if (link.type === "valve") useCurve(link.curve, \`\${link.label} curve\`);
}
for (const cp of network.customerPoints) {
  step();
  for (const d of cp.demands) usePattern(d.pattern ?? null, \`\${cp.label} demand\`);
}
ui.progress(1);

const round = (n) => Math.round(n * 1000) / 1000;
const unused = [
  ...[...patternUses].filter(([, uses]) => uses.length === 0).map(([label]) => \`pattern \${label}\`),
  ...[...curveUses].filter(([, uses]) => uses.length === 0).map(([label]) => \`curve \${label}\`),
];
console.log(\`\${patternUses.size} patterns · \${curveUses.size} curves · \${unused.length} unused\`);
if (unused.length > 0) console.warn(\`Unused: \${unused.join(", ")}\`);

console.table(
  network.patterns.map((p) => ({
    label: p.label,
    type: p.type,
    steps: p.multipliers.length,
    min: Math.min(...p.multipliers),
    max: Math.max(...p.multipliers),
    mean: round(p.multipliers.reduce((sum, m) => sum + m, 0) / p.multipliers.length),
    uses: patternUses.get(p.label).length,
  })),
);
console.table(
  network.curves.map((c) => ({
    label: c.label,
    type: c.type,
    points: c.points.length,
    uses: curveUses.get(c.label).length,
  })),
);

const rows = ["kind,label,used by"];
for (const [kind, uses] of [["pattern", patternUses], ["curve", curveUses]]) {
  for (const [label, by] of uses) {
    if (by.length === 0) rows.push([kind, label, ""].join(","));
    for (const user of by) rows.push([kind, label, user].join(","));
  }
}
ui.attachFile("pattern-and-curve-usage.csv", rows.join("\\n"));
`,
  },
  {
    id: "export-inp",
    name: "Export the network as INP",
    source: `// Builds the same INP as File > Export INP, from the network this script
// reads. A model that needs EPANET-LSX logs a warning naming the assets.
const name = \`\${network.name}.inp\`;
ui.attachFile(name, network.toInp());
console.log(
  \`Exported \${network.nodes.length} nodes and \${network.links.length} links to \${name}\`,
);
`,
  },
  {
    id: "inp-sections",
    name: "Count INP sections",
    source: `// Lists each section of the exported INP with its row count, to compare
// against a file from File > Export INP without opening it.
const rows = [];
for (const line of network.toInp().split("\\n")) {
  const text = line.trim();
  if (text.startsWith("[")) rows.push({ section: text, rows: 0 });
  else if (text !== "" && !text.startsWith(";") && rows.length > 0)
    rows[rows.length - 1].rows++;
}
console.table(rows.filter((row) => row.section !== "[END]"));
`,
  },
];
