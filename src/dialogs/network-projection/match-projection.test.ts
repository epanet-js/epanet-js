import { describe, it, expect } from "vitest";
import {
  matchesProjection,
  hasExactProjectionMatch,
  projectionMatchRank,
} from "./match-projection";

const projection = (id: string, name: string) => ({ id, name });

describe("matchesProjection", () => {
  describe("code matching", () => {
    it("matches with colon", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "epsg:3456")).toBe(
        true,
      );
    });

    it("matches without colon", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "epsg3456")).toBe(
        true,
      );
    });

    it("matches with space instead of colon", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "epsg 3456")).toBe(
        true,
      );
    });

    it("matches partial numeric", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "3456")).toBe(true);
    });

    it("does not match wrong code", () => {
      expect(matchesProjection(projection("EPSG:3456", ""), "9999")).toBe(
        false,
      );
    });
  });

  describe("name matching", () => {
    it("matches by name case-insensitively", () => {
      expect(
        matchesProjection(projection("EPSG:1234", "Some Name"), "some name"),
      ).toBe(true);
    });

    it("matches name with spaces removed", () => {
      expect(
        matchesProjection(
          projection("EPSG:1234", "Abidjan 1987"),
          "abidjan1987",
        ),
      ).toBe(true);
    });
  });
});

describe("hasExactProjectionMatch", () => {
  const projections = [
    projection("EPSG:4326", "WGS 84"),
    projection("EPSG:3857", "WGS 84 / Pseudo-Mercator"),
  ];

  it("matches normalized name exactly", () => {
    expect(hasExactProjectionMatch(projections, "wgs84")).toBe(true);
  });

  it("matches with spaces in query", () => {
    expect(hasExactProjectionMatch(projections, "wgs 84")).toBe(true);
  });

  it("matches normalized id exactly", () => {
    expect(hasExactProjectionMatch(projections, "epsg:4326")).toBe(true);
  });

  it("rejects query shorter than 5 alphanumeric chars", () => {
    expect(hasExactProjectionMatch(projections, "4326")).toBe(false);
  });

  it("rejects short query", () => {
    expect(hasExactProjectionMatch(projections, "wgs")).toBe(false);
  });

  it("matches full normalized name", () => {
    expect(hasExactProjectionMatch(projections, "wgs84pseudomercator")).toBe(
      true,
    );
  });

  it("rejects partial name match", () => {
    expect(hasExactProjectionMatch(projections, "wgs84pseudo")).toBe(false);
  });

  it("rejects non-matching query", () => {
    expect(hasExactProjectionMatch(projections, "nonexistent12345")).toBe(
      false,
    );
  });
});

describe("projectionMatchRank", () => {
  it("ranks exact match highest", () => {
    expect(
      projectionMatchRank(projection("EPSG:4326", "WGS 84"), "wgs84"),
    ).toBe(0);
  });

  it("ranks exact id match highest", () => {
    expect(
      projectionMatchRank(projection("EPSG:4326", "WGS 84"), "epsg:4326"),
    ).toBe(0);
  });

  it("ranks starts-with match above contains", () => {
    const startsWith = projectionMatchRank(
      projection("EPSG:4326", "WGS 84"),
      "wgs",
    );
    const contains = projectionMatchRank(
      projection("EPSG:1234", "Unknown datum based upon the WGS 84 ellipsoid"),
      "wgs",
    );
    expect(startsWith).toBeLessThan(contains);
  });

  it("ranks contains match lowest", () => {
    expect(
      projectionMatchRank(
        projection(
          "EPSG:1234",
          "Unknown datum based upon the WGS 84 ellipsoid",
        ),
        "wgs84",
      ),
    ).toBe(2);
  });
});
