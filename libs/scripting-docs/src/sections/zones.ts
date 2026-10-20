import { memberOf, propertyOf } from "../members";
import type { Section } from "../types";

const zones = memberOf("Zones");
const zone = propertyOf("Zone");

export const SECTION: Section = {
  id: "zones",
  number: "2",
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
