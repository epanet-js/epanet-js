import type { ExampleScript } from "./types";

export const exampleScripts: ExampleScript[] = [
  {
    id: "select-small-pipes",
    name: "Select small pipes",
    paid: false,
    needsEdits: false,
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
    paid: false,
    needsEdits: false,
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
    id: "scale-demands",
    name: "Scale demands by a percentage",
    paid: false,
    needsEdits: true,
    source: `const PERCENT = 10; // 10 raises every demand by 10%, -10 lowers it by 10%

// Uses the selected junctions and customer points, or all of them when nothing is selected.
const junctions = selection.isEmpty ? network.junctions : selection.junctions;
const customerPoints = selection.isEmpty ? network.customerPoints : selection.customerPoints;
if (junctions.length + customerPoints.length === 0) {
  throw new Error("Select junctions or customer points, or clear the selection");
}

const factor = 1 + PERCENT / 100;
const scaled = (demands) => demands.map((d) => ({ ...d, base: d.base * factor }));
const round = (n) => Math.round(n * 1000) / 1000;
const totals = () => ({
  junctions: round(junctions.reduce((sum, j) => sum + j.baseDemand, 0)),
  customerPoints: round(customerPoints.reduce((sum, cp) => sum + cp.demand, 0)),
});

const before = totals();
for (const junction of junctions) junction.setDemands(scaled(junction.demands));
for (const point of customerPoints) point.setDemands(scaled(point.demands));

// A change reads back straight away, and the whole run is one step to undo.
console.table([
  { when: "before", ...before },
  { when: "after", ...totals() },
]);
`,
  },
  {
    id: "export-pipes-csv",
    name: "Export pipes to CSV",
    paid: false,
    needsEdits: false,
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
    paid: false,
    needsEdits: false,
    source: `const ATTRIBUTE = "Class"; // the custom attribute's name, as in the asset panel
const TYPE = "pipe"; // the asset type it is defined for

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
    paid: false,
    needsEdits: false,
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
    paid: false,
    needsEdits: false,
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
    paid: false,
    needsEdits: false,
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
    id: "tag-assets-by-zone",
    name: "Tag assets with their zone",
    paid: false,
    needsEdits: true,
    source: `const ATTRIBUTE = "Zone";
const ZONE_DEMAND = "Base demand";

if (zones.count === 0) throw new Error("Import zones first: File › Import › Zones");

const define = (type, name, valueType) => {
  const exists = network.customAttributes(type).some((a) => a.name.toLowerCase() === name.toLowerCase());
  if (!exists) network.addCustomAttribute(type, { name, type: valueType });
};
define("junction", ATTRIBUTE, "text");
define("pipe", ATTRIBUTE, "text");
define("zone", ZONE_DEMAND, "number");

// A pipe is in a zone only when the whole line is, so one crossing a boundary is left empty.
const assets = [...network.junctions, ...network.pipes];
const demands = new Map(zones.list.map((zone) => [zone, 0]));
const outside = [];
for (const [i, asset] of assets.entries()) {
  ui.progress(i / assets.length);
  const [zone] = zones.at(asset);
  asset.setCustom(ATTRIBUTE, zone?.label ?? null);
  if (!zone) outside.push(asset);
  else if (asset.type === "junction") demands.set(zone, demands.get(zone) + asset.baseDemand);
}
ui.progress(1);

for (const [zone, demand] of demands) zone.setCustom(ZONE_DEMAND, demand);

console.table([...demands].map(([zone, demand]) => ({ zone, [ZONE_DEMAND]: Math.round(demand * 1000) / 1000 })));
console.log(\`\${assets.length - outside.length} assets tagged · \${outside.length} outside every zone, selected on the map\`);
selection.set(outside);
`,
  },
  {
    id: "network-review",
    name: "Network review report",
    paid: true,
    needsEdits: false,
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
    id: "upsize-fastest-pipes",
    name: "Upsize the fastest pipes",
    paid: false,
    needsEdits: true,
    source: `const COUNT = 5; // how many of the fastest pipes to upsize, when no pipe is selected
const SIZES = network.units.diameter === "mm"
  ? [50, 80, 100, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200]
  : [2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 30, 36, 42, 48];

if (!network.results) throw new Error("Run a simulation first");
if (network.results.isStale) console.warn("The results are from before the last change to the model");

const peakVelocity = (pipe) =>
  (pipe.results?.series("velocity") ?? []).reduce((peak, v) => Math.max(peak, Math.abs(v)), 0);

const byVelocity = (pipes) =>
  pipes
    .map((pipe) => ({ pipe, velocity: peakVelocity(pipe) }))
    .filter(({ velocity }) => velocity > 0)
    .sort((a, b) => b.velocity - a.velocity);

// The selected pipes that carry water, or else the fastest in the network.
const selected = byVelocity(selection.pipes);
if (selection.pipes.length > 0 && selected.length === 0) {
  console.warn("The selected pipes carry no flow, so this uses the fastest pipes in the network");
}
const fastest = selected.length > 0 ? selected : byVelocity(network.pipes).slice(0, COUNT);
if (fastest.length === 0) throw new Error("No pipe has flow in the results");

const rows = [];
const upsized = [];
for (const { pipe, velocity } of fastest) {
  const size = SIZES.find((s) => s > pipe.diameter);
  if (size === undefined) continue;
  // The same flow through a wider pipe: velocity falls with the square of the diameter.
  const estimate = velocity * (pipe.diameter / size) ** 2;
  rows.push({
    pipe,
    from: pipe.diameter,
    to: size,
    "peak velocity": Math.round(velocity * 100) / 100,
    estimated: Math.round(estimate * 100) / 100,
  });
  pipe.set({ diameter: size });
  upsized.push(pipe);
}

console.log(\`\${upsized.length} pipes upsized · diameter in \${network.units.diameter}, velocity in \${network.units.velocity}\`);
console.table(rows);
console.log("Run the simulation again to see the effect");
selection.set(upsized);
map.zoomTo(upsized);
`,
  },
  {
    id: "water-source",
    name: "Where does this node get its water?",
    paid: false,
    needsEdits: false,
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
    id: "renew-oldest-pipes",
    name: "Renew the oldest pipes",
    paid: false,
    needsEdits: true,
    source: `const COUNT = 20; // how many of the oldest pipes to renew, when no pipe is selected
const NEW_MATERIAL = "uPVC"; // must be in the pipe library
const RENEWAL_YEAR = 2026;

if (!network.getPipeMaterial(NEW_MATERIAL)) {
  throw new Error(\`\${NEW_MATERIAL} is not in the pipe library — change NEW_MATERIAL\`);
}

// The selected pipes, or the oldest ones that have an install year.
const pipes = selection.pipes.length > 0
  ? selection.pipes
  : network.pipes
      .filter((pipe) => pipe.year !== null)
      .sort((a, b) => a.year - b.year)
      .slice(0, COUNT);
if (pipes.length === 0) throw new Error("No pipe has an install year — select the pipes to renew");

const rows = new Map();
for (const pipe of pipes) {
  const material = pipe.material ?? "(none)";
  const before = pipe.appliedRoughness;
  // A new material and year, and no roughness of its own: the library sets the rest.
  pipe.set({ material: NEW_MATERIAL, year: RENEWAL_YEAR, roughness: null });
  const row = rows.get(material) ?? { material, pipes: 0, length: 0, before: 0, after: 0 };
  row.pipes += 1;
  row.length += pipe.length;
  row.before += before ?? pipe.appliedRoughness;
  row.after += pipe.appliedRoughness;
  rows.set(material, row);
}

console.log(\`\${pipes.length} pipes renewed as \${NEW_MATERIAL} · length in \${network.units.length}\`);
console.table(
  [...rows.values()].map(({ material, pipes, length, before, after }) => ({
    material,
    pipes,
    length: Math.round(length),
    "mean roughness before": Math.round(before / pipes),
    "mean roughness after": Math.round(after / pipes),
  })),
);
console.log("Run the simulation again to see the effect");
selection.set(pipes);
map.zoomTo(pipes);
`,
  },
  {
    id: "infer-pipe-attributes",
    name: "Infer missing pipe attributes",
    paid: false,
    needsEdits: true,
    source: `// Infer missing pipe attributes from the nearest pipe that has a value.
//
// For each attribute, every pipe with a value is a donor. A pipe without one
// takes the value of the nearest donor, measured along the run of empty pipes
// between them. A direct neighbour is at distance 0, so it always qualifies.
// Uses the selected pipes, or every pipe when no pipe is selected. Donors are
// always the whole network.

const INFER = { diameter: true, material: true, year: true };

// How far to carry a value through pipes that have none, in the project
// length unit. 0 fills direct neighbours only. Infinity has no limit.
const MAX_DISTANCE = Infinity;

// Carry values across valves (they count as zero length). Pumps are never crossed.
const CROSS_VALVES = true;

// Values to treat as empty, on top of a blank. Material ignores case,
// e.g. material: ["", "UNKNOWN", "UNK"].
const ALSO_MISSING = { diameter: [0], material: [""], year: [0] };

// ---------------------------------------------------------------------------

const attributes = Object.keys(INFER).filter((attribute) => INFER[attribute]);
if (attributes.length === 0) throw new Error("Nothing to infer: turn something on in INFER");
if (!(MAX_DISTANCE >= 0)) throw new Error("MAX_DISTANCE must be 0 or more");

const scope = selection.pipes.length > 0 ? new Set(selection.pipes) : null;
const pipes = network.pipes;

const normalise = (value) => (typeof value === "string" ? value.trim().toUpperCase() : value);
const lengthOf = (pipe) => pipe.length || pipe.geometryLength || 0;

// A small binary heap of [distance, node].
const makeHeap = () => {
  const items = [];
  return {
    get size() {
      return items.length;
    },
    push(item) {
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (items[parent][0] <= items[i][0]) break;
        [items[parent], items[i]] = [items[i], items[parent]];
        i = parent;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length > 0) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const left = 2 * i + 1;
          const right = left + 1;
          let smallest = i;
          if (left < items.length && items[left][0] < items[smallest][0]) smallest = left;
          if (right < items.length && items[right][0] < items[smallest][0]) smallest = right;
          if (smallest === i) break;
          [items[smallest], items[i]] = [items[i], items[smallest]];
          i = smallest;
        }
      }
      return top;
    },
  };
};

// The nearest donor for every junction, walking out from all donors at once.
// network.trace gives the distance to the nearest start but not which start
// it was, so this is a multi-source Dijkstra over node.links.
const nearestDonors = (attribute, missing) => {
  const best = new Map(); // node -> { distance, value, donor, mixed }
  const heap = makeHeap();
  const offer = (node, distance, value, donor, mixed) => {
    if (node.type !== "junction") return;
    const current = best.get(node);
    if (!current || distance < current.distance) {
      best.set(node, { distance, value, donor, mixed });
      heap.push([distance, node]);
    } else if (distance === current.distance && value !== current.value) {
      current.mixed = true; // two different values equally close
    }
  };

  for (const pipe of pipes) {
    if (missing.has(pipe)) continue;
    offer(pipe.startNode, 0, pipe[attribute], pipe, false);
    offer(pipe.endNode, 0, pipe[attribute], pipe, false);
  }

  while (heap.size > 0) {
    const [distance, node] = heap.pop();
    const current = best.get(node);
    if (distance > current.distance) continue;
    for (const link of node.links) {
      let step;
      if (link.type === "pipe" && missing.has(link)) step = lengthOf(link);
      else if (link.type === "valve" && CROSS_VALVES) step = 0;
      else continue;
      const next = distance + step;
      if (next > MAX_DISTANCE) continue;
      const other = link.startNode === node ? link.endNode : link.startNode;
      offer(other, next, current.value, current.donor, current.mixed);
    }
  }
  return best;
};

const csvCell = (value) => {
  const text = String(value);
  return /[",\\n]/.test(text) ? \`"\${text.replace(/"/g, '""')}"\` : text;
};

const summary = [];
const csv = ["pipe,attribute,value,donor,distance,ambiguous"];
const changed = new Set();

for (const [index, attribute] of attributes.entries()) {
  ui.progress(index / attributes.length, \`Inferring \${attribute}\`);

  const empty = ALSO_MISSING[attribute].map(normalise);
  const missing = new Set(
    pipes.filter((pipe) => pipe[attribute] === null || empty.includes(normalise(pipe[attribute]))),
  );
  const todo = [...missing].filter((pipe) => !scope || scope.has(pipe));
  const best = nearestDonors(attribute, missing);

  // Work everything out before writing, so an inferred value is never a donor.
  const fills = [];
  const unresolved = [];
  for (const pipe of todo) {
    const a = best.get(pipe.startNode);
    const b = best.get(pipe.endNode);
    const pick = !b || (a && a.distance <= b.distance) ? a : b;
    if (!pick) {
      unresolved.push(pipe);
      continue;
    }
    const ambiguous = pick.mixed || Boolean(a && b && a.distance === b.distance && a.value !== b.value);
    fills.push({ pipe, ...pick, ambiguous });
  }

  for (const { pipe, value, donor, distance, ambiguous } of fills) {
    pipe.set({ [attribute]: value });
    changed.add(pipe);
    csv.push([pipe.label, attribute, value, donor.label, Math.round(distance * 100) / 100, ambiguous].map(csvCell).join(","));
  }

  const ambiguous = fills.filter((fill) => fill.ambiguous).map((fill) => fill.pipe);
  if (fills.length > 0) collections.saveSelectionSet(\`Inferred \${attribute}\`, fills.map((fill) => fill.pipe));
  if (ambiguous.length > 0) collections.saveSelectionSet(\`Inferred \${attribute}: ambiguous\`, ambiguous);
  if (unresolved.length > 0) collections.saveSelectionSet(\`Still missing \${attribute}\`, unresolved);

  summary.push({
    attribute,
    missing: todo.length,
    filled: fills.length,
    ambiguous: ambiguous.length,
    "still missing": unresolved.length,
  });
}
ui.progress(1);

const limit = MAX_DISTANCE === Infinity ? "no distance limit" : \`up to \${MAX_DISTANCE} \${network.units.length}\`;
console.log(\`\${scope ? scope.size + " selected" : pipes.length} pipes checked · \${limit}\`);
console.table(summary);

if (changed.size === 0) {
  console.log("Nothing was filled in");
} else {
  ui.attachFile("inferred-values.csv", csv.join("\\n"));
  selection.set([...changed]);
}
`,
  },
  {
    id: "pattern-and-curve-usage",
    name: "Pattern and curve usage",
    paid: false,
    needsEdits: false,
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
