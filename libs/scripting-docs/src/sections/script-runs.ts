import type { Section } from "../types";

export const SECTION: Section = {
  id: "how-a-script-runs",
  title: "How a script runs",
  intro: `- **Globals:** \`network\`, \`selection\`, \`map\`, \`console\`, \`ui\`, \`collections\`. There is no \`fetch\`, DOM, \`require\`/\`import\`, timers (\`setTimeout\`), \`structuredClone\` or network access.
- **Standard JavaScript works:** \`Array\`, \`Map\`, \`Set\`, \`JSON\`, \`Math\`, \`Number\`, \`String\`, template strings, destructuring, \`async\`/\`await\` (top-level \`await\` is allowed).
- **The sandbox is SES (hardened JavaScript).** \`Date.now()\`, \`new Date()\` with no arguments and \`Math.random()\` throw. \`new Date(milliseconds)\` and date arithmetic on given values work. Do not reach for the current time or randomness.
- **Scripts run top to bottom, once.** Every call is synchronous. The script's output — \`selection.set\`, \`map.zoomTo\`, \`ui.attachFile\`, \`collections.saveSelectionSet\` — is applied when the script ends successfully. If the script throws, the error is shown with its line number and none of that output is applied (console lines already printed stay visible).
- **Read-only.** Every value a script receives is frozen. Assigning to an asset field throws (\`Cannot set property diameter … which has only a getter\`). Lists a member returns directly (\`network.pipes\`, \`selection.assets\`, \`network.findWithin(...)\`, \`network.findSubnetworks()\`) are fresh arrays the script may sort or push into. Arrays inside a returned object or an asset (\`network.trace(...).nodes\`, \`finding.assets\`, \`junction.links\`, \`pipe.vertices\`) are frozen: copy them first (\`[...zone.nodes].sort(...)\`).
- **Units:** every number is in the **project's units**. \`network.units\` maps each quantity to its unit (\`network.units.diameter === "mm"\`, \`network.units.length === "m"\`, \`network.units.flow === "l/s"\`). A unit of \`null\` means the quantity is dimensionless or depends on the model (e.g. roughness).
- **Labels:** assets are addressed by **label**, the name shown in the app and written to INP files. Labels are unique, case-insensitively, within the node group (junctions, reservoirs, tanks), within the link group (pipes, pumps, valves) and within customer points. A node and a link may share a label.
- **Coordinates** are \`[lng, lat]\` positions; a bounding box is \`[minLng, minLat, maxLng, maxLat]\`.
- **Inactive assets** (\`asset.isActive === false\`) are in the lists and lookups but are left out of the simulation, the INP and the review checks.`,
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
