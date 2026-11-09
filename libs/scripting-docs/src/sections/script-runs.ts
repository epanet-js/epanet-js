import type { DocsCandidates, SectionDef } from "../types";

const OUTPUT =
  "`selection.set`, `map.zoomTo`, `ui.attachFile`, `collections.saveSelectionSet`, `collections.saveBookmark`";

const FAILED_RUN =
  "If the script throws, the error is shown with its line number and none of that";

const ASSIGNING =
  "Every value a script receives is frozen. Assigning to an asset field throws (`Cannot set property diameter … which has only a getter`).";

const READ_ONLY = {
  running: `The script's output — ${OUTPUT} — is applied when the script ends successfully. ${FAILED_RUN} output is applied`,
  values: `**Read-only.** ${ASSIGNING}`,
};

const WITH_EDITS = {
  running: `A change to the model reads back straight away, within the run. The changes and the script's output — ${OUTPUT} — are applied together when the script ends successfully. ${FAILED_RUN} is applied`,
  values: `**Frozen values, changed through methods.** ${ASSIGNING} Change the model with the methods this reference lists, such as \`asset.set(...)\`. A method that changes the model throws when the project cannot be edited right now, for example on Main once the project has scenarios; the message says why.`,
};

const introOf = ({ running, values }: typeof READ_ONLY): string =>
  `- **Globals:** \`network\`, \`zones\`, \`selection\`, \`map\`, \`console\`, \`ui\`, \`collections\`. There is no \`fetch\`, DOM, \`require\`/\`import\`, timers (\`setTimeout\`), \`structuredClone\` or network access.
- **Standard JavaScript works:** \`Array\`, \`Map\`, \`Set\`, \`JSON\`, \`Math\`, \`Number\`, \`String\`, template strings, destructuring, \`async\`/\`await\` (top-level \`await\` is allowed).
- **The sandbox is SES (hardened JavaScript).** \`Date.now()\`, \`new Date()\` with no arguments and \`Math.random()\` throw. \`new Date(milliseconds)\` and date arithmetic on given values work. Do not reach for the current time or randomness.
- **Scripts run top to bottom, once.** Every call is synchronous. ${running} (console lines already printed stay visible).
- ${values} Lists a member returns directly (\`network.pipes\`, \`selection.assets\`, \`network.findWithin(...)\`, \`network.findSubnetworks()\`) are fresh arrays the script may sort or push into. Arrays inside a returned object or an asset (\`network.trace(...).nodes\`, \`finding.assets\`, \`junction.links\`, \`pipe.vertices\`) are frozen: copy them first (\`[...zone.nodes].sort(...)\`).
- **Units:** every number is in the **project's units**. \`network.units\` maps each quantity to its unit (\`network.units.diameter === "mm"\`, \`network.units.length === "m"\`, \`network.units.flow === "l/s"\`). A unit of \`null\` means the quantity is dimensionless or depends on the model (e.g. roughness).
- **Labels:** assets are addressed by **label**, the name shown in the app and written to INP files. Labels are unique, case-insensitively, within the node group (junctions, reservoirs, tanks), within the link group (pipes, pumps, valves) and within customer points. A node and a link may share a label.
- **Coordinates** are \`[lng, lat]\` positions; a bounding box is \`[minLng, minLat, maxLng, maxLat]\`.
- **Inactive assets** (\`asset.isActive === false\`) are in the lists and lookups but are left out of the simulation, the INP and the review checks.`;

const SECTION: SectionDef = {
  id: "how-a-script-runs",
  title: "How a script runs",
  intro: introOf(READ_ONLY),
  types: [
    {
      name: "Position",
      definition: "type Position = [lng: number, lat: number];",
      summary: "A point on the map.",
    },
    {
      name: "BBox",
      definition:
        "type BBox = [minLng: number, minLat: number, maxLng: number, maxLat: number];",
      summary: "A bounding box.",
    },
  ],
};

export const sectionFor = ({ edits }: DocsCandidates): SectionDef =>
  edits ? { ...SECTION, intro: introOf(WITH_EDITS) } : SECTION;
