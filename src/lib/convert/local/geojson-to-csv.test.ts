import { expect, test } from "vitest";

import { DEFAULT_EXPORT_OPTIONS } from "..";
import { geojsonToCSV } from "./geojson-to-csv";

test("geojsonToCSV", () => {
  expect(
    geojsonToCSV(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Null island" },
            geometry: {
              type: "Point",
              coordinates: [0, 0],
            },
          },
        ],
      },
      DEFAULT_EXPORT_OPTIONS,
    ),
  ).toEqual(`name,latitude,longitude
Null island,0,0`);

  expect(
    geojsonToCSV(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Null island" },
            geometry: {
              type: "MultiPoint",
              coordinates: [[0, 0]],
            },
          },
        ],
      },
      DEFAULT_EXPORT_OPTIONS,
    ),
  ).toEqual(`name,latitude,longitude
Null island,0,0`);
});
