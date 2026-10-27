import type { ExampleScript } from "./types";

export const exampleScripts: ExampleScript[] = [
  {
    id: "select-small-pipes",
    name: "Select small pipes",
    source: `const MAX_DIAMETER = 100; // select pipes at or below this (project units)

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
    id: "count-by-custom-attribute",
    name: "Count by custom attribute",
    source: `const ATTRIBUTE = "Zone"; // the custom attribute's name, as in the asset panel
const TYPE = "junction"; // the asset type it is defined for

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
    source: `const MAIN_DIAMETER = 300; // stop at pipes at or above this (project units)

// The Trace tool's boundary mode stops at tanks, reservoirs, pumps, closed
// links and valves other than open TCVs. The function in stopAt adds the
// mains, so the zone is the area fed through the smaller pipes around the
// selection. A function can stop on any field: material, age, a custom
// attribute.
if (selection.isEmpty) throw new Error("Select a junction or a pipe to start from");

const zone = network.trace(selection.assets, {
  stopAt: [
    "tanks",
    "reservoirs",
    "pumps",
    "controlValves",
    (asset) => asset.type === "pipe" && asset.diameter >= MAIN_DIAMETER,
  ],
});
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

// A bookmark per zone in Collections, to jump between them from the map.
for (const zone of zones.list) collections.saveBookmark(zone.label, zone.bbox);

const outside = network.junctions.filter((j) => zones.at(j).length === 0);
if (outside.length > 0) {
  console.warn(\`\${outside.length} junctions are in no zone\`);
  selection.set(outside);
  map.zoomTo(outside);
}
`,
  },
  {
    id: "network-review",
    name: "Network review report",
    source: `const PROXIMITY = network.units.length === "ft" ? 1.5 : 0.5; // the review panel's default (project units)

// The Network Review panel's checks in one pass: the checks behind Run
// (orphans, areas with no reservoir or tank, attribute rules), then pipes
// that cross without a junction and nodes close to a pipe they are not
// connected to. Each finding is saved as a selection set in Collections.
const report = network.validate();
const crossings = network.findCrossingPipes();
const anomalies = network.findProximityAnomalies({ distance: PROXIMITY });

const findings = report.findings.map((finding) => ({
  severity: finding.severity,
  check: finding.code,
  assets: finding.details
    ? [...finding.details.nodes, ...finding.details.links]
    : finding.assets,
}));
if (crossings.length > 0) {
  findings.push({
    severity: "info",
    check: "Crossing pipes",
    assets: [...new Set(crossings.flatMap(({ pipe1, pipe2 }) => [pipe1, pipe2]))],
  });
}
if (anomalies.length > 0) {
  findings.push({
    severity: "info",
    check: "Nodes close to pipes",
    assets: anomalies.map((anomaly) => anomaly.node),
  });
}
if (findings.length === 0) {
  console.log("No issues found");
} else {
  const { errors, warnings } = report.counts;
  console.warn(\`\${errors} errors · \${warnings} warnings · \${findings.length} findings\`);
  console.table(
    findings.map((f, i) => ({ "#": i + 1, severity: f.severity, check: f.check, assets: f.assets.length })),
  );

  const rows = ["finding,severity,check,type,label"];
  for (const [i, f] of findings.entries()) {
    collections.saveSelectionSet(\`\${i + 1}. \${f.check}\`, f.assets);
    for (const asset of f.assets) {
      rows.push([i + 1, f.severity, f.check, asset.type, asset.label].join(","));
    }
  }
  ui.attachFile("network-review.csv", rows.join("\\n"));

  // Findings come worst first.
  selection.set(findings[0].assets);
  map.zoomTo(findings[0].assets);
}
`,
  },
  {
    id: "water-source",
    name: "Where does this node get its water?",
    source: `// The path from each reservoir and tank to the selected node. weightBy
// makes a pipe cost length / diameter⁵, roughly how its headloss grows, so
// the path follows the large pipes the water would take rather than the
// shortest line. Pumps and valves cost nothing; a pipe with no diameter is
// never crossed.
const [node] = selection.assets;
if (selection.assets.length !== 1 || !node.isNode) throw new Error("Select one node");

const sources = [...network.reservoirs, ...network.tanks];
if (sources.length === 0) throw new Error("This network has no reservoir or tank");

const preferLargePipes = (link) => {
  if (link.type !== "pipe") return 0;
  return link.diameter > 0 ? link.length / link.diameter ** 5 : Infinity;
};

const rows = [];
const paths = [];
for (const source of sources) {
  const path = network.shortestPath(source, node, { weightBy: preferLargePipes });
  if (path === null) continue;
  const pipes = path.links.filter((link) => link.type === "pipe");
  const smallest = pipes.reduce((min, p) => (min === null || p.diameter < min.diameter ? p : min), null);
  rows.push({
    source,
    length: Math.round(path.totalLength),
    pipes: pipes.length,
    smallestPipe: smallest ?? "",
    diameter: smallest?.diameter ?? "",
  });
  paths.push(...path.nodes, ...path.links);
}
if (rows.length === 0) throw new Error(\`No reservoir or tank reaches \${node.label}\`);

console.log(\`\${rows.length} sources reach \${node.label} · length in \${network.units.length}, diameter in \${network.units.diameter}\`);
console.table(rows);

const assets = [...new Set(paths)];
selection.set(assets);
map.zoomTo(assets);
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
];
