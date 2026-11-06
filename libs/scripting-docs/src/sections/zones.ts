import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, SectionDef } from "../types";
import { setCustomOf } from "./assets";

const zones = memberOf("Zones");
const zone = propertyOf("Zone");

const SECTION: SectionDef = {
  id: "zones",
  title: "`zones` — the project's polygons",
  intro: `The polygons imported with **File › Import › Zones** — DMAs, pressure zones, supply areas. They are drawn boundaries, unrelated to connectivity: \`network.trace\` walks the pipes and knows nothing about them.

A node, a customer point or a \`[lng, lat]\` position is inside a zone when its point is. A link is inside only when the whole line is, so a pipe that crosses the boundary, or crosses one of the zone's holes, is in no zone. \`network.findWithin(zone.geometry)\` uses the same rule.`,
  types: [
    {
      name: "ZoneTarget",
      definition:
        "type ZoneTarget = Position | Asset | string | CustomerPoint;",
      summary:
        "Something a zone can contain: a position, an asset or its label, or a customer point.",
    },
  ],
  members: [
    propertyOf("Zones")("list", "Zone[]", "Every zone."),
    propertyOf("Zones")("count", "number", "How many zones there are."),
    zones({
      name: "get",
      signature: "get(label: string): Zone | null",
      summary: "The first zone with that label, case-insensitively, or `null`.",
    }),
    zones({
      name: "at",
      signature: "at(target: ZoneTarget): Zone[]",
      summary:
        "Every zone that contains the target. Zones may overlap; `[]` means it is in none.",
      throws: [
        '`zones.at found no asset labelled "X"`',
        "`zones.at expects a [lng, lat] position, an asset, an asset label or a customer point`",
      ],
    }),
    zone("label", "string", "The zone's label."),
    zone(
      "geometry",
      "GeoJSON.MultiPolygon",
      "The zone's polygons, holes included.",
    ),
    zone("bbox", "BBox", "The zone's extent."),
    zone("area", "number", "The zone's area, in `units.area`."),
    memberOf("Zone")({
      name: "contains",
      signature: "contains(target: ZoneTarget): boolean",
      summary: "Whether the zone contains the target.",
      throws: [
        "`zone.contains expects a [lng, lat] position, an asset, an asset label or a customer point`",
      ],
      examples: [
        {
          title: "Junctions per zone",
          code: `for (const zone of zones.list) {
  const junctions = network.junctions.filter((j) => zone.contains(j));
  console.log(zone.label, junctions.length);
}`,
        },
      ],
    }),
  ],
  notes:
    "`console` and `ui.attachFile` print a zone as its label. Zones are the same in every scenario.",
};

const ZONE_EDITS: Member[] = [
  memberOf("Zone")({
    name: "getCustom",
    signature: "getCustom(name: string): string | number | null",
    summary: "A custom attribute's value by its name, or `null`.",
  }),
  setCustomOf(
    "Zone",
    `network.addCustomAttribute("zone", { name: "Owner", type: "text" });
zones.get("NORTH").setCustom("Owner", "OPERATIONS");`,
  ),
  memberOf("Zone")({
    name: "set",
    signature: `set(changes: {
  label?: string;
}): void`,
    summary: "Changes the zone's label.",
    description:
      "A label is unique among the zones, ignoring case. The zone reads the new label straight away and `zones.get` stops finding the old one; the change reaches the network with the other changes.",
    throws: [
      "`TypeError` when `changes` names anything else, `label` is empty or not a string, or another zone has it.",
    ],
    examples: [{ code: `zones.get("NORTH").set({ label: "NORTH-EAST" });` }],
  }),
];

const DELETE_ZONE: Member = memberOf("Network")({
  name: "deleteZone",
  signature: "deleteZone(label: string): void",
  summary: "Deletes a zone by its label, ignoring case.",
  description:
    "The zone leaves `zones` straight away and its label is free again. A zone the script still holds stops reading. The deletion reaches the network with the other changes.",
  throws: [
    "`TypeError` when no zone has that label, or deleting zones is not available yet.",
  ],
  examples: [{ code: `network.deleteZone("NORTH");` }],
});

export const sectionFor = ({ edits }: DocsCandidates): SectionDef =>
  edits
    ? {
        ...SECTION,
        members: [...(SECTION.members ?? []), ...ZONE_EDITS, DELETE_ZONE],
        notes:
          "`console` and `ui.attachFile` print a zone as its label. A change made in a scenario stays in that scenario.",
      }
    : SECTION;
