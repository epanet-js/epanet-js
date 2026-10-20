import { memberOf, propertyOf } from "../members";
import type { Section } from "../types";

const network = memberOf("Network");
const geo = memberOf("NetworkGeo");

export const SECTION: Section = {
  id: "spatial",
  number: "1.5",
  title: "Spatial queries and geometry",
  types: [
    {
      name: "Area",
      definition: `type Area =
  | GeoJSON.Polygon
  | GeoJSON.MultiPolygon
  | GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
  | BBox
  | Position[];`,
      summary:
        "Where to look: a polygon, a multipolygon, a feature of one, a box or a ring of positions. A node is inside when its point is; a link only when the whole line is, so one crossing a hole is left out.",
    },
    {
      name: "NearestPoint",
      definition:
        "interface NearestPoint { point: Position; distance: number; chainage: number; fraction: number }",
      summary:
        "The closest point on a line, how far it is, how far along the line, and the fraction of the line.",
    },
  ],
  members: [
    network({
      name: "findWithin",
      signature:
        'findWithin(area: Area, options?: { types?: (AssetType | "customerPoint")[] }): (Asset | CustomerPoint)[]',
      summary: "The assets inside an area.",
      params: [
        {
          name: "options.types",
          description:
            'The asset types to return, and `"customerPoint"`. The default is every asset type, without customer points.',
        },
      ],
    }),
    network({
      name: "findNear",
      signature:
        'findNear(position: Position, options: { radius: number; types?: (AssetType | "customerPoint")[] }): (Asset | CustomerPoint)[]',
      summary: "The assets within `radius` of a position, nearest first.",
      params: [
        {
          name: "options.radius",
          description: "The distance, in the project length unit.",
        },
        {
          name: "options.types",
          description: "As for `findWithin`.",
        },
      ],
      throws: [
        "`network.findNear expects { radius } as a number of at least 0, in the project length unit`",
      ],
    }),
    propertyOf("Network")(
      "geo",
      "NetworkGeo",
      "Geodesic helpers in the project length unit.",
    ),
    geo({
      name: "distance",
      signature: "distance(a: Position, b: Position): number",
      summary: "The geodesic distance between two positions.",
    }),
    geo({
      name: "length",
      signature: "length(line: Position[]): number",
      summary: "The length of a line of positions.",
    }),
    geo({
      name: "pointAlong",
      signature: "pointAlong(line: Position[], distance: number): Position",
      summary: "The position that far along a line.",
    }),
    geo({
      name: "nearestPoint",
      signature:
        "nearestPoint(line: Position[], position: Position): NearestPoint",
      summary: "The closest point on a line to a position.",
    }),
    geo({
      name: "destination",
      signature:
        "destination(from: Position, bearing: number, distance: number): Position",
      summary: "The position `distance` away on a bearing in degrees.",
    }),
  ],
  notes:
    "`map.bounds` is the user's viewport at run start, so `network.findWithin(map.bounds)` scopes a script to what the user is looking at.",
};
