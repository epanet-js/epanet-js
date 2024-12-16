import { ConvertResult } from "src/lib/convert/utils";
import { Feature, FeatureCollection } from "src/types";
import type { Folder, Root } from "@tmcw/togeojson";

function flattenRoot(root: Root | Folder, features: Feature[] = []) {
  for (const child of root.children) {
    switch (child.type) {
      case "Feature": {
        features.push(child);
        break;
      }
      case "folder": {
        flattenRoot(child, features);
        break;
      }
    }
  }

  return features;
}

export function flattenResult(result: ConvertResult): FeatureCollection {
  switch (result.type) {
    case "geojson":
      return result.geojson;
    case "inp":
      return {
        type: "FeatureCollection",
        features: [...result.hydraulicModel.assets.values()].map(
          (a) => a.feature,
        ),
      };
    case "root":
      return {
        type: "FeatureCollection",
        features: flattenRoot(result.root),
      };
  }
}
